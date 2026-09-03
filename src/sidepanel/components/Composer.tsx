import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationMessage, PageSnapshot } from "../../shared/types";
import {
  estimateDraftInputTokens,
  estimateNextInputUsage,
  MODEL_CONTEXT_LIMIT
} from "../services/PromptContext";

interface ComposerProps {
  page: PageSnapshot | null;
  messages: ConversationMessage[];
  pageStatus: string;
  error: string;
  disabled: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onSubmit: (question: string) => Promise<boolean>;
}

/** 以紧凑形式展示 1M 上下文窗口的占用比例。 */
function formatUsagePercent(tokens: number): string {
  const percent = Math.min(100, Math.max(0, tokens / MODEL_CONTEXT_LIMIT * 100));
  if (percent > 0 && percent < 0.1) return "<0.1%";
  return `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
}

/** 管理问题草稿、页面操作和当前网页信息。 */
export function Composer({
  page,
  messages,
  pageStatus,
  error,
  disabled,
  onRefresh,
  onOpenSettings,
  onSubmit
}: ComposerProps) {
  const [question, setQuestion] = useState("");
  const [usageOpen, setUsageOpen] = useState(false);
  const usageRef = useRef<HTMLDivElement>(null);
  const baseUsage = useMemo(
    () => estimateNextInputUsage(page, messages, ""),
    [messages, page]
  );
  const draftTokens = useMemo(() => estimateDraftInputTokens(question), [question]);
  const usage = useMemo(() => {
    const segments = baseUsage.segments.map((segment) =>
      segment.key === "draft" ? { ...segment, tokens: draftTokens } : segment
    );
    return {
      segments,
      totalTokens: segments.reduce((total, segment) => total + segment.tokens, 0)
    };
  }, [baseUsage, draftTokens]);
  const usagePercent = Math.min(100, usage.totalTokens / MODEL_CONTEXT_LIMIT * 100);
  const usagePercentLabel = formatUsagePercent(usage.totalTokens);

  useEffect(() => {
    if (!usageOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !usageRef.current?.contains(event.target)) {
        setUsageOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [usageOpen]);

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
        <div className="context-usage" ref={usageRef}>
          <button
            className="context-usage-trigger"
            type="button"
            title="查看下一轮上下文用量"
            aria-label={`查看上下文使用情况，已占用 ${usagePercentLabel}`}
            aria-expanded={usageOpen}
            onClick={() => setUsageOpen((current) => !current)}
          >
            <svg className="context-usage-ring" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="context-usage-ring-track" cx="12" cy="12" r="8" />
              <circle
                className="context-usage-ring-value"
                cx="12"
                cy="12"
                r="8"
                pathLength="100"
                strokeDasharray={`${usagePercent} ${100 - usagePercent}`}
              />
            </svg>
          </button>
          {usageOpen && (
            <div className="context-usage-popover" role="dialog" aria-label="上下文使用情况">
              <div className="context-usage-header">
                <strong>上下文使用情况</strong>
                <button
                  className="context-usage-close"
                  type="button"
                  aria-label="关闭上下文使用情况"
                  onClick={() => setUsageOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="context-usage-summary">
                <span>{usagePercentLabel} 已占用</span>
                <span>约 {usage.totalTokens.toLocaleString()} / 1M tokens</span>
              </div>
              <div className="context-usage-bar" aria-hidden="true">
                {usage.segments.filter((segment) => segment.tokens > 0).map((segment) => (
                  <span
                    className={`context-${segment.key}`}
                    key={segment.key}
                    style={{ width: `${(segment.tokens / Math.max(1, usage.totalTokens)) * 100}%` }}
                  />
                ))}
              </div>
              <dl className="context-usage-list">
                {usage.segments.map((segment) => (
                  <div key={segment.key}>
                    <dt>
                      <span className={`context-usage-dot context-${segment.key}`} aria-hidden="true" />
                      {segment.label}
                    </dt>
                    <dd>{segment.tokens.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
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
