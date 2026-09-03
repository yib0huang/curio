import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  children: string;
  className?: string;
}

/**
 * 安全渲染模型返回的 Markdown。
 *
 * 原始 HTML 和远程图片可能执行欺骗展示或发起跟踪请求，因此始终禁用；链接在独立标签页打开。
 */
export function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown
        disallowedElements={["img"]}
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
