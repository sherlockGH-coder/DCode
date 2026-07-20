import React, { useCallback, useRef, useState, type ReactNode } from 'react';

interface MarkdownTableWrapperProps {
  children: ReactNode;
}

/** 从 table DOM 元素提取 Markdown 管道格式文本 */
function extractTableMarkdown(tableEl: HTMLTableElement): string {
  const rows: string[] = [];
  let colCount = 0;

  for (const tr of tableEl.querySelectorAll('tr')) {
    const cells: string[] = [];
    for (const cell of tr.querySelectorAll('th, td')) {
      cells.push(cell.textContent?.trim() ?? '');
    }
    colCount = Math.max(colCount, cells.length);
    rows.push(cells.join(' | '));
  }

  if (rows.length === 0) return '';

  const separator = Array(colCount).fill('---').join(' | ');
  const result = [rows[0], separator];
  for (let i = 1; i < rows.length; i++) {
    result.push(rows[i]);
  }

  return `| ${result.join('\n| ')} |`;
}

const MarkdownTableWrapper: React.FC<MarkdownTableWrapperProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const table = containerRef.current?.querySelector('table');
    if (!table) return;

    try {
      const text = extractTableMarkdown(table);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制表格失败:', err);
    }
  }, []);

  return (
    <div ref={containerRef} className="table-wrapper">
      {children}
      <button
        className="table-copy-btn"
        onClick={handleCopy}
        title="复制表格"
      >
        {copied ? '✓ 已复制' : '复制'}
      </button>
    </div>
  );
};

export default MarkdownTableWrapper;
