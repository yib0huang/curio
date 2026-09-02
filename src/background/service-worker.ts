/**
 * @file Curio 后台 Service Worker。
 * 仅配置扩展工具栏按钮与 Chrome Side Panel 的打开行为。
 */

/**
 * 配置扩展按钮行为，使用户点击工具栏图标时打开侧边栏。
 *
 * @returns {void}
 */
function configureSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

// 安装和浏览器启动时都显式配置，避免 Service Worker 重启后依赖隐式状态。
chrome.runtime.onInstalled.addListener(configureSidePanel);
chrome.runtime.onStartup.addListener(configureSidePanel);
