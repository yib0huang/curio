/**
 * @file 侧边栏 React 应用入口，负责挂载根组件和全局样式。
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("未找到 React 根节点");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
