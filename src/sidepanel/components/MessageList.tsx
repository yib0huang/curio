import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "../../shared/types";
import { MarkdownContent } from "./MarkdownContent";

interface MessageListProps {
  messages: ConversationMessage[];
}

interface ReasoningBlockProps {
  elapsedSeconds?: number;
  reasoning: string;
  startedAt?: number;
  streaming: boolean;
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
  elapsedSeconds,
  reasoning,
  startedAt,
  streaming
}: ReasoningBlockProps) {
  const runningSeconds = useElapsedSeconds(streaming, startedAt);
  const statusText = streaming
    ? runningSeconds === 0
      ? "思考中…"
      : `已处理 ${formatElapsedTime(runningSeconds)}`
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
        <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
          {message.role === "assistant" ? (
            <>
              {(message.status !== undefined || message.reasoning) && (
                <ReasoningBlock
                  elapsedSeconds={message.elapsedSeconds}
                  reasoning={message.reasoning ?? ""}
                  startedAt={message.startedAt}
                  streaming={message.status === "streaming"}
                />
              )}
              {message.content && (
                <MarkdownContent className="assistant-output">
                  {message.content}
                </MarkdownContent>
              )}
            </>
          ) : (
            message.content
          )}
        </div>
      ))}
    </section>
  );
}
