import { describe, expect, it } from "vitest";
import { ConversationStore } from "../src/sidepanel/services/ConversationStore";

describe("ConversationStore", () => {
  it("更新流式内容、冻结耗时并隔离标签页", () => {
    const store = new ConversationStore();
    store.startTurn(1, "问题", 1_000);
    store.updateStreamingAssistant(1, "回答", "思考");
    store.completeTurn(1, 9_900);

    expect(store.get(1)).toEqual([
      { role: "user", content: "问题" },
      {
        role: "assistant",
        content: "回答",
        reasoning: "思考",
        status: "complete",
        startedAt: 1_000,
        elapsedSeconds: 8
      }
    ]);
    expect(store.get(2)).toEqual([]);
  });

  it("失败时回滚未完成的一问一答", () => {
    const store = new ConversationStore();
    store.startTurn(1, "问题", 1_000);
    expect(store.rollbackTurn(1)).toEqual([]);
  });
});
