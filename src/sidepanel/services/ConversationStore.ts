import type { ConversationMessage } from "../../shared/types";

/** 在 Side Panel 生命周期内按标签页隔离多轮对话。 */
export class ConversationStore {
  private readonly conversations = new Map<number, ConversationMessage[]>();

  /** 返回指定标签页的会话副本，防止调用方直接修改内部状态。 */
  get(tabId: number | null): ConversationMessage[] {
    if (tabId === null) return [];
    return [...(this.conversations.get(tabId) ?? [])];
  }

  /** 追加问题和一个空的助手消息，供流式响应持续更新。 */
  startTurn(
    tabId: number,
    question: string,
    startedAt = Date.now()
  ): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    messages.push(
      { role: "user", content: question },
      { role: "assistant", content: "", status: "streaming", startedAt }
    );
    this.conversations.set(tabId, messages);
    return [...messages];
  }

  /** 首问先追加独立的网页读取记录，读取结束后再创建模型回答消息。 */
  startPageReadTurn(
    tabId: number,
    question: string,
    initialContent = "",
    startedAt = Date.now()
  ): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    messages.push(
      { role: "user", content: question },
      {
        role: "assistant",
        kind: "page-read",
        content: initialContent,
        activity: "正在读取网页…",
        status: "streaming",
        startedAt
      }
    );
    this.conversations.set(tabId, messages);
    return [...messages];
  }

  /** 固化网页读取内容，并另起一条模型思考与回答消息。 */
  completePageRead(
    tabId: number,
    pageContent: string,
    completedAt = Date.now()
  ): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    const pageRead = messages.at(-1);
    if (pageRead?.kind === "page-read" && pageRead.status === "streaming") {
      const startedAt = pageRead.startedAt ?? completedAt;
      messages[messages.length - 1] = {
        ...pageRead,
        content: pageContent,
        activity: undefined,
        status: "complete",
        elapsedSeconds: Math.max(0, Math.floor((completedAt - startedAt) / 1000))
      };
      messages.push({
        role: "assistant",
        kind: "answer",
        content: "",
        activity: "正在思考…",
        status: "streaming",
        startedAt: completedAt
      });
    }
    return [...messages];
  }

  /** 用当前已接收的完整快照更新正在生成的助手消息。 */
  updateStreamingAssistant(
    tabId: number,
    content: string,
    reasoning: string,
    outputTokens?: number
  ): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    const assistant = messages.at(-1);
    if (assistant?.role === "assistant" && assistant.status === "streaming") {
      messages[messages.length - 1] = {
        ...assistant,
        content,
        reasoning,
        ...(outputTokens === undefined ? {} : { outputTokens })
      };
    }
    return [...messages];
  }

  /** 更新首轮网页采集或模型生成阶段的即时状态。 */
  setStreamingActivity(tabId: number, activity: string): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    const assistant = messages.at(-1);
    if (assistant?.role === "assistant" && assistant.status === "streaming") {
      messages[messages.length - 1] = { ...assistant, activity };
    }
    return [...messages];
  }

  /** 将流式助手消息标记为完成，使思考摘要默认收起。 */
  completeTurn(tabId: number, completedAt = Date.now()): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    const assistant = messages.at(-1);
    if (assistant?.role === "assistant" && assistant.status === "streaming") {
      const startedAt = assistant.startedAt ?? completedAt;
      messages[messages.length - 1] = {
        ...assistant,
        activity: undefined,
        status: "complete",
        elapsedSeconds: Math.max(0, Math.floor((completedAt - startedAt) / 1000))
      };
    }
    return [...messages];
  }

  /** 请求失败时移除尚未完成的一问一答，保持历史可再次提交。 */
  rollbackTurn(tabId: number): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    if (messages.at(-1)?.status === "streaming") {
      let lastUserIndex = -1;
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") {
          lastUserIndex = index;
          break;
        }
      }
      if (lastUserIndex >= 0) messages.splice(lastUserIndex);
    }
    return [...messages];
  }
}
