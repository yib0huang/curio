import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ConversationMessage,
  ModelSettings,
  PageSnapshot
} from "../../shared/types";
import { ChromePageService } from "../services/ChromePageService";
import { ConversationStore } from "../services/ConversationStore";
import { ResponsesClient } from "../services/ResponsesClient";
import { SettingsRepository } from "../services/SettingsRepository";

/** 组合 UI 所需状态以及领域服务，组件不直接访问 Chrome 和模型 API。 */
export function useCurioController() {
  const pageService = useMemo(() => new ChromePageService(), []);
  const conversationStore = useMemo(() => new ConversationStore(), []);
  const settingsRepository = useMemo(() => new SettingsRepository(), []);
  const responsesClient = useMemo(() => new ResponsesClient(), []);

  const [tabId, setTabId] = useState<number | null>(null);
  const [page, setPage] = useState<PageSnapshot | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [pageStatus, setPageStatus] = useState("正在读取当前网页…");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshPage = useCallback(async () => {
    setError("");
    setPageStatus("正在读取当前网页…");
    const result = await pageService.readActivePage();
    setTabId(result.tabId);
    setPage(result.page);
    setPageStatus(result.status);
    setError(result.error ?? "");
    setMessages(conversationStore.get(result.tabId));
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
    async (rawQuestion: string): Promise<boolean> => {
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
      try {
        const history = conversationStore.get(tabId);
        const answer = await responsesClient.answer(
          currentSettings,
          page,
          history,
          question
        );
        setMessages(conversationStore.appendTurn(tabId, question, answer));
        return true;
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : String(requestError)
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationStore, page, responsesClient, sending, settingsRepository, tabId]
  );

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
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [refreshPage]);

  return {
    page,
    messages,
    pageStatus,
    error,
    sending,
    settings,
    settingsOpen,
    refreshPage,
    openSettings,
    closeSettings: () => setSettingsOpen(false),
    saveSettings,
    submitQuestion
  };
}
