import { useEffect, useRef, useState } from "react";
import type { ConversationMessage, TokenUsage } from "../../shared/types";
import { MarkdownContent } from "./MarkdownContent";

interface MessageListProps {
  messages: ConversationMessage[];
}

interface ReasoningBlockProps {
  activity?: string;
  elapsedSeconds?: number;
  reasoning: string;
  startedAt?: number;
  streaming: boolean;
}

interface PageReadBlockProps {
  message: ConversationMessage;
}

interface TokenUsageDetailsProps {
  usage: TokenUsage;
}

/** 将秒数格式化为与 Codex 状态行一致的中文时长。 */
export function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return minutes > 0 ? `${minutes}分钟 ${seconds}秒` : `${seconds}秒`;
}

/** 根据真实开始时间推进秒表，浏览器定时器被节流后也不会累计漂移。 */
function useElapsedSeconds(streaming: boolean, startedAt?: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!streaming || startedAt === undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, streaming]);

  if (startedAt === undefined) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** 默认收起推理摘要，仅保留计时状态；展开状态完全由用户控制。 */
function ReasoningBlock({
  activity,
  elapsedSeconds,
  reasoning,
  startedAt,
  streaming
}: ReasoningBlockProps) {
  const runningSeconds = useElapsedSeconds(streaming, startedAt);
  const statusText = streaming
    ? activity || (runningSeconds === 0
      ? "思考中…"
      : `已处理 ${formatElapsedTime(runningSeconds)}`)
    : `用时 ${formatElapsedTime(elapsedSeconds ?? 0)}`;

  if (!streaming && !reasoning) {
    return <div className="reasoning-status">{statusText}</div>;
  }

  return (
    <details className="reasoning">
      <summary>{statusText}</summary>
      {reasoning && (
        <MarkdownContent className="reasoning-content">{reasoning}</MarkdownContent>
      )}
    </details>
  );
}

/** 独立展示首问所使用的网页快照，避免与模型推理混在同一条消息中。 */
function PageReadBlock({ message }: PageReadBlockProps) {
  const streaming = message.status === "streaming";

  return (
    <details className={`page-read ${streaming ? "streaming" : "complete"}`}>
      <summary>
        <span className="page-read-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 3.5h7l3 3V20H7z" />
            <path d="M14 3.5V7h3M9.5 11h5M9.5 14h5M9.5 17h3.5" />
          </svg>
        </span>
        <span className="page-read-title">
          {streaming ? message.activity || "正在读取网页…" : "网页内容已读取"}
        </span>
        {!streaming && (
          <span className="page-read-meta">
            {message.content.length.toLocaleString()} 字符
          </span>
        )}
      </summary>
      {message.content && (
        <div className="page-read-body">
          <div className="page-read-content">
            <MarkdownContent>{message.content}</MarkdownContent>
          </div>
          <div className="page-read-actions">
            <MessageCopyButton
              content={message.content}
              label="复制网页内容"
              successLabel="已复制"
              labeled
            />
          </div>
        </div>
      )}
    </details>
  );
}

interface MessageCopyButtonProps {
  content: string;
  label: string;
  labeled?: boolean;
  successLabel: string;
}

/** 复制网页快照或单条模型回答，并就地反馈复制结果。 */
function MessageCopyButton({
  content,
  label,
  labeled = false,
  successLabel
}: MessageCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = undefined;
    setCopied(false);
    return () => window.clearTimeout(resetTimerRef.current);
  }, [content]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = undefined;
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      className={`message-copy-button${labeled ? " labeled" : ""}`}
      type="button"
      title={copied ? successLabel : label}
      aria-label={copied ? successLabel : label}
      onClick={() => void copy()}
    >
      <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true">
        {copied ? (
          <path d="m5 12 4 4L19 6" />
        ) : (
          <>
            <rect x="8" y="8" width="11" height="11" rx="2" />
            <path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" />
          </>
        )}
      </svg>
      {labeled && <span>{copied ? successLabel : label}</span>}
    </button>
  );
}

/** 将 API 返回的本轮 usage 展开为互不重叠的 token 分布。 */
function TokenUsageDetails({ usage }: TokenUsageDetailsProps) {
  const [open, setOpen] = useState(false);
  const freshInputTokens = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const answerTokens = Math.max(0, usage.outputTokens - usage.reasoningTokens);
  const segments = [
    { className: "fresh-input", label: "输入（未缓存）", value: freshInputTokens },
    { className: "cached-input", label: "输入（缓存）", value: usage.cachedInputTokens },
    { className: "reasoning-output", label: "推理", value: usage.reasoningTokens },
    { className: "answer-output", label: "可见回答", value: answerTokens }
  ];
  const distributionTotal = Math.max(
    1,
    segments.reduce((total, segment) => total + segment.value, 0)
  );

  return (
    <div className="token-usage">
      <button
        className="token-usage-trigger"
        type="button"
        title="查看本轮 token 分布"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="token-spark" aria-hidden="true">✦</span>
        {answerTokens.toLocaleString()} tokens
      </button>
      {open && (
        <div className="token-usage-popover" role="dialog" aria-label="本轮 Token 用量">
          <div className="token-usage-header">
            <strong>本轮 Token 用量</strong>
            <span>共 {usage.totalTokens.toLocaleString()}</span>
            <button
              className="token-usage-close"
              type="button"
              aria-label="关闭 Token 用量"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="token-usage-bar" aria-hidden="true">
            {segments.filter((segment) => segment.value > 0).map((segment) => (
              <span
                className={segment.className}
                key={segment.className}
                style={{ width: `${(segment.value / distributionTotal) * 100}%` }}
              />
            ))}
          </div>
          <dl className="token-usage-list">
            {segments.map((segment) => (
              <div key={segment.className}>
                <dt>
                  <span className={`token-usage-dot ${segment.className}`} aria-hidden="true" />
                  {segment.label}
                </dt>
                <dd>{segment.value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/** 以纯文本渲染多轮对话，并在新增内容后滚动到底部。 */
export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (container && shouldAutoScrollRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <section
      ref={containerRef}
      className="messages active"
      aria-live="polite"
      onScroll={(event) => {
        const container = event.currentTarget;
        shouldAutoScrollRef.current =
          container.scrollHeight - container.scrollTop - container.clientHeight < 48;
      }}
    >
      {messages.map((message, index) => (
        <div
          className={`message ${message.role}${message.kind === "page-read" ? " page-read-message" : ""}`}
          key={`${message.role}-${index}`}
        >
          {message.role === "assistant" ? (
            message.kind === "page-read" ? (
              <PageReadBlock message={message} />
            ) : (
              <>
                {(message.status !== undefined || message.reasoning) && (
                  <ReasoningBlock
                    activity={message.activity}
                    elapsedSeconds={message.elapsedSeconds}
                    reasoning={message.reasoning ?? ""}
                    startedAt={message.startedAt}
                    streaming={message.status === "streaming"}
                  />
                )}
                {message.content && (
                  <>
                    <MarkdownContent className="assistant-output">
                      {message.content}
                    </MarkdownContent>
                    <div className="message-actions">
                      {message.status === "complete" && (
                        <MessageCopyButton
                          content={message.content}
                          label="复制回答"
                          successLabel="回答已复制"
                        />
                      )}
                      {message.status === "complete" && message.tokenUsage && (
                        <TokenUsageDetails usage={message.tokenUsage} />
                      )}
                    </div>
                  </>
                )}
              </>
            )
          ) : (
            message.content
          )}
        </div>
      ))}
    </section>
  );
}
