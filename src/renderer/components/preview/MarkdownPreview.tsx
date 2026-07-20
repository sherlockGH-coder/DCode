import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = memo(({ content }) => {
  return (
    <div className="p-6 markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownPreview;
