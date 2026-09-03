import { FormEvent, KeyboardEvent, useState } from "react";
import type { PageSnapshot } from "../../shared/types";

interface ComposerProps {
  page: PageSnapshot | null;
  pageStatus: string;
  error: string;
  disabled: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onSubmit: (question: string) => Promise<boolean>;
}

/** 管理问题草稿、页面操作和当前网页信息。 */
export function Composer({
  page,
  pageStatus,
  error,
  disabled,
  onRefresh,
  onOpenSettings,
  onSubmit
}: ComposerProps) {
  const [question, setQuestion] = useState("");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (await onSubmit(question)) setQuestion("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <footer className="composer-wrap">
      {error && <div className="error-banner">{error}</div>}
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={3}
          maxLength={4000}
          placeholder="关于这个页面，想问什么？"
          aria-label="问题"
          value={question}
          disabled={disabled}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" aria-label="发送" disabled={disabled || !question.trim()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
          </svg>
        </button>
      </form>
      <div className="composer-toolbar">
        <button
          className="icon-button"
          type="button"
          title="重新读取网页"
          aria-label="重新读取网页"
          onClick={onRefresh}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M19 11a7 7 0 1 0 .2 3" />
          </svg>
        </button>
        <div className="page-meta" aria-live="polite">
          <span className="page-title" title={page ? pageStatus : undefined}>
            {page ? page.title || "无标题页面" : pageStatus}
          </span>
        </div>
        <button
          className="icon-button settings-button"
          type="button"
          title="设置"
          aria-label="设置"
          onClick={onOpenSettings}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
