import { FormEvent, KeyboardEvent, useState } from "react";

interface ComposerProps {
  error: string;
  disabled: boolean;
  onSubmit: (question: string) => Promise<boolean>;
}

/** 管理问题草稿、键盘提交和请求失败后的输入保留。 */
export function Composer({ error, disabled, onSubmit }: ComposerProps) {
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
          rows={1}
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
      <small>AI 可能会出错，请核实重要信息</small>
    </footer>
  );
}
