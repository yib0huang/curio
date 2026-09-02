interface HeaderProps {
  pageStatus: string;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

/** 展示品牌、页面读取状态和侧边栏全局操作。 */
export function Header({ pageStatus, onRefresh, onOpenSettings }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <img
          className="brand-mark"
          src={chrome.runtime.getURL("assets/icons-v3/icon-48.png")}
          alt="Curio"
        />
        <div>
          <h1>Curio</h1>
          <p>{pageStatus}</p>
        </div>
      </div>
      <div className="actions">
        <button className="icon-button" title="重新读取网页" aria-label="重新读取网页" onClick={onRefresh}>
          ↻
        </button>
        <button className="icon-button" title="设置" aria-label="设置" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>
    </header>
  );
}
