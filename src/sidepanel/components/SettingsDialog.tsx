import { FormEvent, useEffect, useRef, useState } from "react";
import type { ModelSettings } from "../../shared/types";

interface SettingsDialogProps {
  open: boolean;
  settings: ModelSettings | null;
  onClose: () => void;
  onSave: (settings: ModelSettings) => Promise<void>;
}

/** 使用原生 dialog 管理模型连接设置。 */
export function SettingsDialog({ open, settings, onClose, onSave }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ModelSettings | null>(settings);

  useEffect(() => setDraft(settings), [settings]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    await onSave({
      apiUrl: draft.apiUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim()
    });
  };

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <form id="settings-form" onSubmit={submit}>
        <div className="dialog-title">
          <h2>模型设置</h2>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <label>
          API 地址
          <input
            type="url"
            required
            value={draft?.apiUrl ?? ""}
            onChange={(event) => draft && setDraft({ ...draft, apiUrl: event.target.value })}
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={draft?.apiKey ?? ""}
            onChange={(event) => draft && setDraft({ ...draft, apiKey: event.target.value })}
          />
        </label>
        <label>
          模型
          <input
            type="text"
            required
            value={draft?.model ?? ""}
            onChange={(event) => draft && setDraft({ ...draft, model: event.target.value })}
          />
        </label>
        <p className="privacy-note">
          设置仅保存在当前 Chrome 浏览器中。页面正文会在你发送问题时传给该 API。
        </p>
        <button className="primary" type="submit">
          保存设置
        </button>
      </form>
    </dialog>
  );
}
