import React, { memo, useEffect, useMemo, useRef } from 'react';
import { SyntaxHighlighter, oneDark, oneLight } from '../../utils/syntaxHighlighter';

interface CodePreviewProps {
  code: string;
  language?: string;
  isDark?: boolean;
  initialLine?: number;
}

const CodePreview: React.FC<CodePreviewProps> = memo(({ code, language, isDark = false, initialLine }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetLine = Number.isInteger(initialLine) && initialLine! > 0 ? initialLine : undefined;

  useEffect(() => {
    if (!targetLine) return;
    const line = containerRef.current?.querySelector(`[data-line-number="${targetLine}"]`);
    line?.scrollIntoView({ block: 'center' });
  }, [targetLine, code]);

  const lineProps = useMemo(() => (lineNumber: number) => {
    const isTarget = targetLine === lineNumber;
    return {
      'data-line-number': lineNumber,
      style: isTarget
        ? {
          display: 'block',
          margin: '0 -16px',
          padding: '0 16px',
          background: 'rgba(56, 151, 248, 0.14)',
          boxShadow: 'inset 3px 0 0 #3897F8',
        }
        : { display: 'block' },
    };
  }, [targetLine]);

  return (
    <div ref={containerRef} className="min-h-full">
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: '16px',
          fontSize: '13px',
          minHeight: '100%',
          background: 'var(--bg-workspace)',
        }}
        showLineNumbers
        wrapLines
        lineProps={lineProps}
        lineNumberStyle={{ opacity: 0.35, minWidth: '2.5em' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

export default CodePreview;
