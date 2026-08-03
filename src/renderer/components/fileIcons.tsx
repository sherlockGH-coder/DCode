import React from 'react';

/**
 * `react-material-icon-theme` inlines the complete Material file-icon set, about 1.1 MB before compression,
 * which accounts for nearly a third of the renderer bundle even though the welcome screen does not use it.
 * Load it on demand and show a same-size neutral glyph until it is ready to avoid layout shifts.
 */
const LazyFileIcon = React.lazy(async () => {
  const mod = await import('react-material-icon-theme');
  return { default: mod.FileIcon };
});

/** Same-size placeholder glyph for FileIcon, shown briefly while the icon package loads. */
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
