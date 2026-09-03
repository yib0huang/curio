// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsesClient } from "../src/sidepanel/services/ResponsesClient";

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
          ]
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

    expect(result).toEqual({ content: "最终回答", reasoning: "先分析" });
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
              ]
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

    expect(result).toEqual({ content: "最终回答", reasoning: "内部分析" });
    expect(progress.at(-1)).toEqual(result);
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
});
