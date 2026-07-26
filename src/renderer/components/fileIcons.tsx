import React from 'react';

/**
 * `react-material-icon-theme` 内联了整套 Material 文件图标，压缩前约 1.1MB，
 * 占渲染包近三成，而首屏（欢迎页）根本用不到它。
 * 这里改成按需加载，未就绪时用一个同尺寸的中性字形占位，避免布局抖动。
 */
const LazyFileIcon = React.lazy(async () => {
  const mod = await import('react-material-icon-theme');
  return { default: mod.FileIcon };
});

/** 与 FileIcon 同尺寸的占位字形，仅在图标包加载完成前短暂出现。 */
const FileIconPlaceholder: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5L9 1.5Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      opacity="0.45"
    />
  </svg>
);

function normalizeMaterialFileName(filename: string): string {
  const withoutDiffSuffix = filename.replace(/\s*\(diff\)$/i, '');
  const withoutLocationSuffix = withoutDiffSuffix.split(':')[0].split('#')[0];
  return withoutLocationSuffix.split('/').pop()?.split('\\').pop() || withoutLocationSuffix;
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  html: 'html',
};

export const getFileIcon = (ext: string, filename: string, className?: string): React.ReactNode => {
  const normalizedFilename = normalizeMaterialFileName(filename);
  const normalizedExt = (ext || normalizedFilename.split('.').pop() || '').replace(/^\./, '').toLowerCase();
  const languageId = EXTENSION_TO_LANGUAGE[normalizedExt];

  return (
    <span className={`${className || 'shrink-0'} inline-flex items-center justify-center translate-y-[0.5px]`} style={{ width: 14, height: 14 }}>
      <React.Suspense fallback={<FileIconPlaceholder />}>
        <LazyFileIcon
          fileName={normalizedFilename}
          fileExtension={normalizedExt}
          languageId={languageId}
          size={14}
          color="currentColor"
        />
      </React.Suspense>
    </span>
  );
};
