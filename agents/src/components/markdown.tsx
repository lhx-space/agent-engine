import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Markdown 渲染（GFM：表格/删除线/任务列表等）。 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
