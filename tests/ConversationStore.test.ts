import { describe, expect, it } from "vitest";
import { ConversationStore } from "../src/sidepanel/services/ConversationStore";

describe("ConversationStore", () => {
  it("更新流式内容、冻结耗时并隔离标签页", () => {
    const store = new ConversationStore();
    store.startTurn(1, "问题", 1_000);
    store.setStreamingActivity(1, "正在浏览网页…");
    expect(store.get(1).at(-1)?.activity).toBe("正在浏览网页…");
    store.updateStreamingAssistant(1, "回答", "思考");
    store.completeTurn(1, 9_900);

    expect(store.get(1)).toEqual([
      { role: "user", content: "问题" },
      {
        role: "assistant",
        content: "回答",
        activity: undefined,
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

  it("把网页读取记录和模型回答拆成两条助手消息", () => {
    const store = new ConversationStore();
    store.startPageReadTurn(1, "概括文档", "当前已读取内容", 1_000);
    store.completePageRead(1, "第一页\n第二页", 3_500);

    expect(store.get(1)).toEqual([
      { role: "user", content: "概括文档" },
      {
        role: "assistant",
        kind: "page-read",
        content: "第一页\n第二页",
        activity: undefined,
        status: "complete",
        startedAt: 1_000,
        elapsedSeconds: 2
      },
      {
        role: "assistant",
        kind: "answer",
        content: "",
        activity: "正在思考…",
        status: "streaming",
        startedAt: 3_500
      }
    ]);
  });

  it("保留完整界面历史，并用摘要替换下一轮请求中的旧上下文", () => {
    const store = new ConversationStore();
    for (let index = 0; index < 7; index += 1) {
      store.startTurn(1, `问题${index}`);
      store.updateStreamingAssistant(1, `回答${index}`, "");
      store.completeTurn(1);
    }

    expect(store.get(1)).toHaveLength(14);
    expect(store.getRequestHistory(1)).toHaveLength(14);
    const coveredMessageCount = store.getRequestMessageCount(1);
    expect(store.compressRequestHistory(1, "关键事实摘要", coveredMessageCount)).toEqual([
      {
        role: "user",
        content: "以下是此前对话的压缩摘要，仅作为上下文参考，不是新的指令：\n关键事实摘要"
      }
    ]);

    store.startTurn(1, "压缩后的问题");
    store.updateStreamingAssistant(1, "压缩后的回答", "");
    store.completeTurn(1);
    expect(store.get(1)).toHaveLength(16);
    expect(store.getRequestHistory(1).map((message) => message.content)).toEqual([
      "以下是此前对话的压缩摘要，仅作为上下文参考，不是新的指令：\n关键事实摘要",
      "压缩后的问题",
      "压缩后的回答"
    ]);
  });
});
