import type { PageSnapshot } from "../../shared/types";

interface PageContextProps {
  page: PageSnapshot | null;
  hasConversation: boolean;
  onAsk: (question: string) => void;
}

const SUGGESTIONS = [
  { label: "总结核心内容", question: "总结这个页面的核心内容" },
  { label: "提取重点", question: "提取这个页面最重要的信息，并用要点列出" },
  { label: "深入分析", question: "这个页面有哪些值得进一步思考或核实的地方？" }
];

/** 展示当前页面摘要以及首次对话的快捷问题。 */
export function PageContext({ page, hasConversation, onAsk }: PageContextProps) {
  return (
    <>
      {page && (
        <section className="page-card">
          <span>当前页面</span>
          <strong>{page.title || "无标题页面"}</strong>
          <small>{page.url}</small>
        </section>
      )}

      {!hasConversation && (
        <section className="empty-state">
          <div className="orb">✦</div>
          <h2>关于这个页面，你想知道什么？</h2>
          <p>我会结合当前网页内容回答，并记住本次对话。</p>
          <div className="suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion.label} onClick={() => onAsk(suggestion.question)}>
                {suggestion.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
