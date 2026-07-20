import React, { useState, useCallback } from 'react';
import { SyntaxHighlighter, oneLight, oneDark } from '../utils/syntaxHighlighter';
import { usePreviewActions } from '../contexts/AppContext';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';

interface CodeBlockProps {
  language: string;
  code: string;
}

const getLanguageLabel = (lang: string): string => {
  if (!lang) return 'Text';
  const l = lang.toLowerCase().trim();
  switch (l) {
    case 'text':
    case 'txt':
    case 'plain':
      return 'Text';
    case 'js':
    case 'javascript':
      return 'JavaScript';
    case 'ts':
    case 'typescript':
      return 'TypeScript';
    case 'tsx':
      return 'React TSX';
    case 'jsx':
      return 'React JSX';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'css':
      return 'CSS';
    case 'json':
      return 'JSON';
    case 'jsonl':
      return 'JSONL';
    case 'py':
    case 'python':
      return 'Python';
    case 'go':
    case 'golang':
      return 'Go';
    case 'rs':
    case 'rust':
      return 'Rust';
    case 'sh':
    case 'bash':
    case 'shell':
    case 'zsh':
      return 'Terminal';
    case 'yaml':
    case 'yml':
      return 'YAML';
    case 'toml':
      return 'TOML';
    case 'md':
    case 'markdown':
      return 'Markdown';
    case 'sql':
      return 'SQL';
    case 'diff':
      return 'Diff';
    case 'dockerfile':
      return 'Docker';
    case 'xml':
      return 'XML';
    default:
      return lang.charAt(0).toUpperCase() + lang.slice(1);
  }
};

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const { setPreview } = usePreviewActions();
  const isDark = useIsDarkTheme();
  const normalizedLanguage = language.toLowerCase().trim();
  const isPlainText = !normalizedLanguage || ['text', 'txt', 'plain'].includes(normalizedLanguage);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {

      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handlePreview = useCallback(() => {
    const isHtml = language === 'html' || language === 'htm';
    setPreview({
      type: isHtml ? 'html' : 'code',
      title: language || 'text',
      content: code,
      language: isHtml ? undefined : language,
    });
  }, [language, code, setPreview]);

  return (
    <div className="my-3 overflow-hidden rounded-[10px] border border-hairline bg-bg-main">
      {                     }
      <div className="flex justify-between items-center py-1.5 px-3 border-b border-hairline select-none">
        <span className="font-mono text-[12.5px] text-text-secondary">
          {getLanguageLabel(language)}
        </span>
        <div className="flex items-center gap-3">
          <button
            className="border-none bg-transparent p-0 text-[12.5px] cursor-pointer transition-colors duration-150 text-text-tertiary hover:text-text-primary"
            onClick={handleCopy}
            title={copied ? '已复制到剪贴板' : '复制代码'}
          >
            {copied ? '已复制' : '复制'}
          </button>
          <button
            className="border-none bg-transparent p-0 text-[12.5px] cursor-pointer transition-colors duration-150 text-text-tertiary hover:text-text-primary"
            onClick={handlePreview}
            title="在工作区预览"
          >
            预览
          </button>
        </div>
      </div>

      {           }
      {isPlainText ? (
        <pre
          data-testid="plain-text-code-body"
          className="m-0 max-h-[360px] overflow-auto whitespace-pre-wrap break-words bg-transparent px-4 py-3.5 font-mono text-[13px] leading-[1.65] text-text-primary"
        >
          {code}
        </pre>
      ) : (
        <div data-testid="syntax-highlighted-code-body">
          <SyntaxHighlighter
            language={language}
            style={isDark ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              padding: '14px 16px',
              fontSize: '13px',
              lineHeight: '1.65',
              fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
              background: 'transparent',
            }}
            showLineNumbers={false}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
