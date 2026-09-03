import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversationMessage,
  ModelSettings,
  PageSnapshot
} from "../../shared/types";
import { ChromePageService } from "../services/ChromePageService";
import { ConversationStore } from "../services/ConversationStore";
import {
  CONTEXT_COMPRESSION_TRIGGER,
  estimateNextInputUsage
} from "../services/PromptContext";
import { ResponsesClient } from "../services/ResponsesClient";
import { SettingsRepository } from "../services/SettingsRepository";

/** 识别由用户停止操作触发的标准请求中止异常。 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** 组合 UI 所需状态以及领域服务，组件不直接访问 Chrome 和模型 API。 */
export function useCurioController() {
  const pageService = useMemo(() => new ChromePageService(), []);
  const conversationStore = useMemo(() => new ConversationStore(), []);
  const settingsRepository = useMemo(() => new SettingsRepository(), []);
  const responsesClient = useMemo(() => new ResponsesClient(), []);

  const [tabId, setTabId] = useState<number | null>(null);
  const [page, setPage] = useState<PageSnapshot | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [contextMessages, setContextMessages] = useState<ConversationMessage[]>([]);
  const [pageStatus, setPageStatus] = useState("正在读取当前网页…");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeTabIdRef = useRef<number | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  const refreshPage = useCallback(async () => {
    setError("");
    setPageStatus("正在读取当前网页…");
    const result = await pageService.readActivePage();
    activeTabIdRef.current = result.tabId;
    setTabId(result.tabId);
    setPage(result.page);
    setPageStatus(result.status);
    setError(result.error ?? "");
    setMessages(conversationStore.get(result.tabId));
    setContextMessages(conversationStore.getRequestHistory(result.tabId));
  }, [conversationStore, pageService]);

  const openSettings = useCallback(async () => {
    setSettings(await settingsRepository.load());
    setSettingsOpen(true);
  }, [settingsRepository]);

  const saveSettings = useCallback(
    async (nextSettings: ModelSettings) => {
      await settingsRepository.save(nextSettings);
      setSettings(nextSettings);
      setSettingsOpen(false);
      setError("");
    },
    [settingsRepository]
  );

  const submitQuestion = useCallback(
    async (rawQuestion: string, onAccepted?: () => void): Promise<boolean> => {
      const question = rawQuestion.trim();
      if (!question || sending) return false;
      if (!page || tabId === null) {
        setError("当前没有可用的网页内容，请先打开普通网页并点击刷新。");
        return false;
      }

      const currentSettings = await settingsRepository.load();
      if (!currentSettings.apiKey) {
        setSettings(currentSettings);
        setSettingsOpen(true);
        setError("请先填写 API Key，然后重新发送问题。");
        return false;
      }

      setError("");
      setSending(true);
      const requestAbortController = new AbortController();
      requestAbortControllerRef.current = requestAbortController;
      onAccepted?.();
      const requestTabId = tabId;
      let history = conversationStore.getRequestHistory(requestTabId);
      const requestMessageCount = conversationStore.getRequestMessageCount(requestTabId);
      const isFirstQuestion = requestMessageCount === 0;
      let requestPage = page;
      setMessages(
        isFirstQuestion
          ? conversationStore.startPageReadTurn(requestTabId, question, page.text)
          : conversationStore.startTurn(requestTabId, question)
      );
      try {
        if (isFirstQuestion) {
          const pageResult = await pageService.readActivePage({ scanVirtualPages: true });
          if (pageResult.tabId !== requestTabId || !pageResult.page) {
            throw new Error(pageResult.error || "浏览网页时当前标签页发生了变化，请重新发送问题。");
          }
          requestPage = pageResult.page;
          if (activeTabIdRef.current === requestTabId) {
            setPage(pageResult.page);
            setPageStatus(pageResult.status);
            setError(pageResult.error ?? "");
          }

          const thinkingMessages = conversationStore.completePageRead(
            requestTabId,
            pageResult.page.text
          );
          if (activeTabIdRef.current === requestTabId) setMessages(thinkingMessages);
          requestAbortController.signal.throwIfAborted();
        }

        const nextInputTokens = estimateNextInputUsage(
          requestPage,
          history,
          question
        ).totalTokens;
        if (history.length > 0 && nextInputTokens >= CONTEXT_COMPRESSION_TRIGGER) {
          const compressingMessages = conversationStore.setStreamingActivity(
            requestTabId,
            "正在压缩上下文…"
          );
          if (activeTabIdRef.current === requestTabId) setMessages(compressingMessages);
          const summary = await responsesClient.compressHistory(
            currentSettings,
            history,
            requestAbortController.signal
          );
          history = conversationStore.compressRequestHistory(
            requestTabId,
            summary,
            requestMessageCount
          );
          const thinkingMessages = conversationStore.setStreamingActivity(
            requestTabId,
            "正在思考…"
          );
          if (activeTabIdRef.current === requestTabId) {
            setMessages(thinkingMessages);
          }
        }

        const answer = await responsesClient.answer(
          currentSettings,
          requestPage,
          history,
          question,
          (progress) => {
            const nextMessages = conversationStore.updateStreamingAssistant(
              requestTabId,
              progress.content,
              progress.reasoning
            );
            if (activeTabIdRef.current === requestTabId) setMessages(nextMessages);
          },
          requestAbortController.signal
        );
        conversationStore.updateStreamingAssistant(
          requestTabId,
          answer.content,
          answer.reasoning
        );
        const nextMessages = conversationStore.completeTurn(requestTabId);
        if (activeTabIdRef.current === requestTabId) {
          setMessages(nextMessages);
          setContextMessages(conversationStore.getRequestHistory(requestTabId));
        }
        return true;
      } catch (requestError) {
        if (requestAbortController.signal.aborted || isAbortError(requestError)) {
          const nextMessages = conversationStore.stopTurn(requestTabId);
          if (activeTabIdRef.current === requestTabId) {
            setMessages(nextMessages);
            setContextMessages(conversationStore.getRequestHistory(requestTabId));
            setError("");
          }
          return true;
        }
        const nextMessages = conversationStore.rollbackTurn(requestTabId);
        if (activeTabIdRef.current === requestTabId) {
          setMessages(nextMessages);
          setContextMessages(conversationStore.getRequestHistory(requestTabId));
        }
        if (activeTabIdRef.current === requestTabId) {
          setError(
            requestError instanceof Error ? requestError.message : String(requestError)
          );
        }
        return false;
      } finally {
        if (requestAbortControllerRef.current === requestAbortController) {
          requestAbortControllerRef.current = null;
        }
        setSending(false);
      }
    },
    [conversationStore, page, pageService, responsesClient, sending, settingsRepository, tabId]
  );

  const stopGeneration = useCallback(() => {
    requestAbortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    void refreshPage();

    const handleActivated = () => void refreshPage();
    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      _updatedTabId,
      changeInfo,
      updatedTab
    ) => {
      if (updatedTab.active && changeInfo.status === "complete") {
        void refreshPage();
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      requestAbortControllerRef.current?.abort();
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [refreshPage]);

  return {
    page,
    messages,
    contextMessages,
    pageStatus,
    error,
    sending,
    settings,
    settingsOpen,
    refreshPage,
    openSettings,
    closeSettings: () => setSettingsOpen(false),
    saveSettings,
    stopGeneration,
    submitQuestion
  };
}
