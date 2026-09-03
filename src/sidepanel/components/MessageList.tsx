import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "../../shared/types";
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
                      {message.outputTokens !== undefined && message.outputTokens > 0 && (
                        <span
                          className={`token-count${message.status === "streaming" ? " streaming" : ""}`}
                          key={message.outputTokens}
                          title={message.outputTokensEstimated ? "生成中，token 数为实时估算" : "本次回答的 output token 数"}
                        >
                          <span className="token-spark" aria-hidden="true">✦</span>
                          {message.outputTokensEstimated ? "约 " : ""}
                          {message.outputTokens.toLocaleString()} tokens
                        </span>
                      )}
                      {message.status === "complete" && (
                        <MessageCopyButton
                          content={message.content}
                          label="复制回答"
                          successLabel="回答已复制"
                        />
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
