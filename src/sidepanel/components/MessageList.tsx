import { useEffect, useRef } from "react";
import type { ConversationMessage } from "../../shared/types";

interface MessageListProps {
  messages: ConversationMessage[];
  pending: boolean;
}

/** 以纯文本渲染多轮对话，并在新增内容后滚动到底部。 */
export function MessageList({ messages, pending }: MessageListProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, pending]);

  if (messages.length === 0 && !pending) return null;

  return (
    <section ref={containerRef} className="messages active" aria-live="polite">
      {messages.map((message, index) => (
        <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
          {message.content}
        </div>
      ))}
      {pending && <div className="message assistant pending">正在阅读和思考…</div>}
    </section>
  );
}
