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
}

/** 内容脚本支持的读取页面消息。 */
export interface ReadPageMessage {
  type: "CURIO_READ_PAGE";
}

/** 内容脚本返回的可判别结果。 */
export type ReadPageResponse =
  | { ok: true; page: PageSnapshot }
  | { ok: false; error: string };
