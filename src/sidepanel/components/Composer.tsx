import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import type { PageSnapshot } from "../../shared/types";

type CopyState = "idle" | "success" | "error";

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
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    setCopyState("idle");
  }, [page]);

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

  /** 仅复制与字符数对应的已提取正文，便于用户检查读取结果。 */
  const copyPageText = async () => {
    if (!page?.text) return;

    try {
      await navigator.clipboard.writeText(page.text);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <footer className="composer-wrap">
      {error && <div className="error-banner">{error}</div>}
      {copyState === "error" && (
        <div className="error-banner">
          复制失败，请检查浏览器剪贴板权限后重试。
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={3}
          maxLength={4000}
          placeholder="询问当前页面…"
          aria-label="问题"
          value={question}
          disabled={disabled}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" aria-label="发送" disabled={disabled}>
          ↑
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
          <span className="page-title" title={page?.title}>
            {page ? page.title || "无标题页面" : pageStatus}
          </span>
          {page && (
            <>
              <span
                className="character-count"
                aria-label={`${page.text.length.toLocaleString()} 个字符`}
              >
                {page.text.length.toLocaleString()}
              </span>
              <button
                className="icon-button copy-button"
                type="button"
                title={copyState === "success" ? "已复制正文" : "复制已读取的正文"}
                aria-label={copyState === "success" ? "正文已复制" : "复制已读取的正文"}
                disabled={!page.text}
                onClick={() => void copyPageText()}
              >
                <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {copyState === "success" ? (
                    <path d="m5 12 4 4L19 6" />
                  ) : (
                    <>
                      <rect x="8" y="8" width="11" height="11" rx="2" />
                      <path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" />
                    </>
                  )}
                </svg>
              </button>
              <span className="visually-hidden" role="status">
                {copyState === "success" ? "已复制当前网页正文" : ""}
              </span>
            </>
          )}
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
