import React, { useRef } from 'react';
import CodeBlock from './CodeBlock';
import { IconGlobe, IconGithub, getFileIcon } from './icons';
import { safeUrlTransform } from '../utils/urlTransform';
import { stripLocalFileReferenceSuffix } from '../utils/localFileReference';
import FilePathTooltip from './FilePathTooltip';

type LocalFileClickHandler = (href: string, e: React.MouseEvent) => void | Promise<void>;

function getTextFromNode(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }
  return '';
}

function isWebUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
}

function stripLocalScheme(href: string): string {
  return href.replace(/^file:\/\//, '').replace(/^local-file:\/\//, '');
}

function isFilePath(path: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(stripLocalFileReferenceSuffix(path));
}

function getFileMeta(value: string): { filename: string; ext: string } {
  const filename = value.split('/').pop()?.split('\\').pop() || value;
  const cleanFilename = stripLocalFileReferenceSuffix(filename);
  const ext = cleanFilename.split('.').pop()?.toLowerCase() || '';
  return { filename, ext };
}

function isInlineFileReference(value: string): boolean {
  if (isWebUrl(value)) return false;
  const cleanValue = stripLocalFileReferenceSuffix(value);
  const hasSlashes = cleanValue.includes('/') || cleanValue.includes('\\');
  return hasSlashes && isFilePath(cleanValue);
}

function getExternalIcon(href: string): React.ReactNode {
  const normalized = href.toLowerCase();
  if (normalized.includes('github.com')) {
    return <IconGithub size={15} className="markdown-link-icon text-current" />;
  }
  return <IconGlobe size={15} className="markdown-link-icon text-current" />;
}

function getSourceReferenceIcon(ext: string, filename: string): React.ReactNode {
  return getFileIcon(ext, filename, 'markdown-source-icon');
}

const CodeRefWithTooltip: React.FC<{
  codeString: string;
  ext: string;
  filename: string;
  handleLocalFileClick: LocalFileClickHandler;
}> = ({ codeString, ext, filename, handleLocalFileClick }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => handleLocalFileClick(codeString, e)}
        className="markdown-local-ref"
      >
        {getSourceReferenceIcon(ext, filename)}
        <span>{filename}</span>
      </button>
      <FilePathTooltip triggerRef={triggerRef} text={codeString} />
    </>
  );
};

const LocalAnchorWithTooltip: React.FC<{
  href: string;
  cleanPath: string;
  filename: string;
  ext: string;
  displayText: React.ReactNode;
  handleLocalFileClick: LocalFileClickHandler;
}> = ({ href, cleanPath, filename, ext, displayText, handleLocalFileClick }) => {
  const triggerRef = useRef<HTMLAnchorElement>(null);
  return (
    <>
      <a
        ref={triggerRef}
        href={href}
        onClick={(e) => handleLocalFileClick(href, e)}
        className="markdown-local-ref"
      >
        {getSourceReferenceIcon(ext, filename)}
        <span>{displayText}</span>
      </a>
      <FilePathTooltip triggerRef={triggerRef} text={cleanPath} />
    </>
  );
};

function renderCode(props: any, handleLocalFileClick: LocalFileClickHandler): React.ReactNode {
  const { className, children, ...restProps } = props;
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  const isBlock = codeString.includes('\n') || !!language;

  if (isBlock) return <CodeBlock language={language} code={codeString} />;
  if (!isInlineFileReference(codeString)) {
    return <code className="markdown-inline-code" {...restProps}>{children}</code>;
  }

  const { filename, ext } = getFileMeta(codeString);
  return (
    <CodeRefWithTooltip
      codeString={codeString}
      ext={ext}
      filename={filename}
      handleLocalFileClick={handleLocalFileClick}
    />
  );
}

function renderLocalAnchor(props: any, handleLocalFileClick: LocalFileClickHandler): React.ReactNode {
  const { children, href = '', ...restProps } = props;
  const cleanPath = stripLocalScheme(href);
  const linkText = getTextFromNode(children);
  const localFilePath = isFilePath(cleanPath);
  const displayText = localFilePath ? getFileMeta(linkText || cleanPath).filename : children;
  const { filename, ext } = getFileMeta(String(displayText));

  if (localFilePath) {
    return (
      <LocalAnchorWithTooltip
        href={href}
        cleanPath={cleanPath}
        filename={filename}
        ext={ext}
        displayText={displayText}
        handleLocalFileClick={handleLocalFileClick}
      />
    );
  }

  return (
    <a
      href={href}
      onClick={(e) => handleLocalFileClick(href, e)}
      className="markdown-link"
      {...restProps}
    >
      <span>{displayText}</span>
    </a>
  );
}

function renderExternalAnchor(props: any): React.ReactNode {
  const { children, href = '', ...restProps } = props;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="markdown-link markdown-external-link"
      {...restProps}
    >
      {getExternalIcon(href)}
      <span>{children}</span>
      <span className="markdown-link-tooltip" role="tooltip">{href}</span>
    </a>
  );
}

function renderAnchor(props: any, handleLocalFileClick: LocalFileClickHandler): React.ReactNode {
  const href = props.href || '';
  return href && !isWebUrl(href)
    ? renderLocalAnchor(props, handleLocalFileClick)
    : renderExternalAnchor(props);
}

export function createMarkdownComponents(handleLocalFileClick: LocalFileClickHandler) {
  return {
    code: (props: any) => renderCode(props, handleLocalFileClick),
    a: (props: any) => renderAnchor(props, handleLocalFileClick),
    img: ({ src, alt }: any) => {
      const safeSrc = safeUrlTransform(src || '');
      if (!safeSrc) return null;
      return <img src={safeSrc} alt={alt || ''} className="markdown-image" loading="lazy" />;
    },
    details: ({ children, ...props }: any) => (
      <details className="markdown-details" {...props}>{children}</details>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="markdown-list markdown-list-unordered" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="markdown-list markdown-list-ordered" {...props}>{children}</ol>
    ),
    summary: ({ children, ...props }: any) => (
      <summary className="markdown-summary" {...props}>{children}</summary>
    ),
    mark: ({ children, ...props }: any) => (
      <mark className="markdown-mark" {...props}>{children}</mark>
    ),
    kbd: ({ children, ...props }: any) => (
      <kbd className="markdown-kbd" {...props}>{children}</kbd>
    ),
  };
}
