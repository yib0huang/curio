import type { ConversationMessage } from "../../shared/types";

/** 在 Side Panel 生命周期内按标签页隔离多轮对话。 */
export class ConversationStore {
  private readonly conversations = new Map<number, ConversationMessage[]>();

  /** 返回指定标签页的会话副本，防止调用方直接修改内部状态。 */
  get(tabId: number | null): ConversationMessage[] {
    if (tabId === null) return [];
    return [...(this.conversations.get(tabId) ?? [])];
  }

  /** 将一轮完整问答追加到指定标签页。 */
  appendTurn(tabId: number, question: string, answer: string): ConversationMessage[] {
    const messages = this.conversations.get(tabId) ?? [];
    messages.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );
    this.conversations.set(tabId, messages);
    return [...messages];
  }
}
