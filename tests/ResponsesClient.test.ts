// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ResponsesClient,
  estimateOutputTokens
} from "../src/sidepanel/services/ResponsesClient";

const settings = {
  apiUrl: "https://example.invalid/v1/responses",
  apiKey: "test-key",
  model: "test-model"
};
const page = {
  title: "测试",
  url: "https://example.com",
  description: "",
  text: "正文",
  capturedAt: ""
};

function createStreamResponse(events: object[], chunkSize = 7): Response {
  const bytes = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
        controller.close();
      }
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ResponsesClient", () => {
  it("从任意 SSE 分片中分离推理摘要和最终回答", async () => {
    const response = createStreamResponse([
      { type: "response.reasoning_summary_text.delta", delta: "先分析" },
      { type: "response.output_text.delta", delta: "最终" },
      { type: "response.output_text.delta", delta: "回答" },
      {
        type: "response.completed",
        response: {
          output: [
            { type: "reasoning", summary: [{ text: "先分析" }] },
            { type: "message", content: [{ text: "最终回答" }] }
          ],
          usage: { output_tokens: 42 }
        }
      }
    ]);
    const fetchMock = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    const progress: object[] = [];

    const result = await new ResponsesClient().answer(
      settings,
      page,
      [],
      "问题",
      (snapshot) => progress.push(snapshot)
    );

    expect(result).toEqual({
      content: "最终回答",
      reasoning: "先分析",
      outputTokens: 42,
      outputTokensEstimated: false
    });
    expect(progress.length).toBeGreaterThanOrEqual(4);
    const request = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(request?.body));
    expect(requestBody).toMatchObject({
      stream: true,
      reasoning: { summary: "auto" },
      store: false
    });
    expect(requestBody.input[0].content).toContain("不要输出分析、草稿、思维过程");
  });

  it("不会把 reasoning item 的正文拼接进最终回答", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        createStreamResponse([
          { type: "response.reasoning_text.delta", delta: "内部分析" },
          { type: "response.output_text.delta", delta: "最终回答" },
          {
            type: "response.completed",
            response: {
              output_text: "内部分析\n最终回答",
              output: [
                { type: "reasoning", content: [{ text: "内部分析" }] },
                { type: "message", content: [{ text: "最终回答" }] }
              ],
              usage: { output_tokens: 18 }
            }
          }
        ])
      )
    );

    const progress: object[] = [];
    const result = await new ResponsesClient().answer(
      settings,
      page,
      [],
      "问题",
      (snapshot) => progress.push(snapshot)
    );

    expect(result).toEqual({
      content: "最终回答",
      reasoning: "内部分析",
      outputTokens: 18,
      outputTokensEstimated: false
    });
    expect(progress.at(-1)).toEqual(result);
  });

  it("不会把界面中的网页读取记录重复发送为对话历史", async () => {
    const response = createStreamResponse([
      {
        type: "response.completed",
        response: { output: [{ type: "message", content: [{ text: "新回答" }] }] }
      }
    ]);
    const fetchMock = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal("fetch", fetchMock);

    await new ResponsesClient().answer(
      settings,
      page,
      [
        { role: "user", content: "旧问题" },
        { role: "assistant", kind: "page-read", content: "不应重复发送的网页快照" },
        { role: "assistant", kind: "answer", content: "旧回答" }
      ],
      "新问题",
      () => undefined
    );

    const request = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(request?.body));
    const historyText = requestBody.input.map((item: { content: string }) => item.content).join("\n");
    expect(historyText).toContain("旧问题");
    expect(historyText).toContain("旧回答");
    expect(historyText).not.toContain("不应重复发送的网页快照");
  });

  it("拒绝把提前断开的半截响应保存为完成回答", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        createStreamResponse([{ type: "response.output_text.delta", delta: "半截" }])
      )
    );

    await expect(
      new ResponsesClient().answer(settings, page, [], "问题", () => undefined)
    ).rejects.toThrow("完成前中断");
  });

  it("流式阶段估算 token，并在完成事件后采用精确 usage", async () => {
    const response = createStreamResponse([
      { type: "response.output_text.delta", delta: "实时" },
      { type: "response.output_text.delta", delta: "回答" },
      {
        type: "response.completed",
        response: {
          output: [{ type: "message", content: [{ text: "实时回答" }] }],
          usage: { output_tokens: 9 }
        }
      }
    ]);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response));
    const progress: Array<{ outputTokens: number; outputTokensEstimated: boolean }> = [];

    const result = await new ResponsesClient().answer(
      settings,
      page,
      [],
      "问题",
      (snapshot) => progress.push(snapshot)
    );

    expect(progress[0]).toMatchObject({ outputTokens: 2, outputTokensEstimated: true });
    expect(progress.at(-1)).toMatchObject({ outputTokens: 9, outputTokensEstimated: false });
    expect(result).toMatchObject({ outputTokens: 9, outputTokensEstimated: false });
    expect(estimateOutputTokens("hello world")).toBeGreaterThan(0);
  });
});
