import React from 'react';
import type { PreviewItem } from '../../types/preview';
import CodePreview from '../preview/CodePreview';
import DiffView from '../preview/DiffView';
import HtmlPreview from '../preview/HtmlPreview';
import ImagePreview from '../preview/ImagePreview';
import MarkdownPreview from '../preview/MarkdownPreview';

const PreviewContent: React.FC<{
  isDarkTheme: boolean;
  preview: PreviewItem | null;
}> = ({ isDarkTheme, preview }) => {
  if (!preview) return null;
  switch (preview.type) {
    case 'code':
      return <CodePreview code={preview.content} language={preview.language} isDark={isDarkTheme} initialLine={preview.initialLine} />;
    case 'html':
      return <HtmlPreview code={preview.content} filePath={preview.filePath} />;
    case 'image':
      return <ImagePreview src={preview.content} />;
    case 'markdown':
      return <MarkdownPreview content={preview.content} />;
    case 'diff':
      return <DiffView diff={preview.content} filename={preview.filePath || preview.title} showStat />;
    default:
      return <CodePreview code={preview.content} isDark={isDarkTheme} initialLine={preview.initialLine} />;
  }
};

export default PreviewContent;
