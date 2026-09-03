/**
 * @file 扩展各运行上下文共享的领域类型。
 */

/** 当前网页经过清理并转换为 Markdown 风格正文后的内容快照。 */
export interface PageSnapshot {
  title: string;
  url: string;
  description: string;
  text: string;
  capturedAt: string;
  /** 提取覆盖范围与降级信息，用于向用户如实展示读取质量。 */
  extraction?: PageExtractionInfo;
}

/** 当前页面快照的采集范围和完整性摘要。 */
export interface PageExtractionInfo {
  frameCount: number;
  inaccessibleFrameCount: number;
  shadowRootCount: number;
  sourceCharacters: number;
  truncated: boolean;
  mode: "structured-dom" | "visible-text" | "multi-frame";
  /** 通过有界滚动从虚拟文档渲染器收集到的页数。 */
  virtualPageCount?: number;
}

/** 用户配置的模型连接信息。 */
export interface ModelSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

/** 一条可发送给模型的对话消息。 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  /** 区分模型回答和仅用于界面展示的网页读取记录。 */
  kind?: "answer" | "page-read";
  /** 请求过程中由客户端展示的当前阶段，不作为模型推理内容持久化。 */
  activity?: string;
  /** 模型提供的推理摘要；它与面向用户的最终回答分开展示。 */
  reasoning?: string;
  /** 仅用于标记正在接收增量内容的临时助手消息。 */
  status?: "streaming" | "complete";
  /** 本轮请求开始时间，用于显示真实经过时间。 */
  startedAt?: number;
  /** 请求完成时冻结的总耗时，避免历史消息继续计时。 */
  elapsedSeconds?: number;
  /** 请求完成后返回的可见回答 output token 数。 */
  outputTokens?: number;
}

/** 内容脚本支持的读取页面消息。 */
export interface ReadPageMessage {
  type: "CURIO_READ_PAGE";
  /** 仅在首问时启用虚拟分页滚动，普通刷新和标签切换不得改变页面位置。 */
  scanVirtualPages?: boolean;
}

/** 内容脚本返回的可判别结果。 */
export type ReadPageResponse =
  | { ok: true; page: PageSnapshot }
  | { ok: false; error: string };
