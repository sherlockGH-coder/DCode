import React from 'react';
import { FileIcon } from 'react-material-icon-theme';

interface IconProps {
  size?: number;
  className?: string;
}

export const IconDocument: React.FC<IconProps> = ({ size = 16, className = 'shrink-0 text-text-secondary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
    <path d="M186.181818 837.818182l325.818182 0 0 46.545455-325.818182 0 0-46.545455ZM837.818182 837.818182 837.818182 884.363636 930.909091 884.363636 930.909091 0 232.727273 0 232.727273 93.090909 279.272727 93.090909 279.272727 46.545455 884.363636 46.545455 884.363636 837.818182ZM186.181818 698.181818l512 0 0 46.545455-512 0 0-46.545455ZM93.090909 149.410909l0 864.814545C93.090909 1019.624727 97.373091 1024 102.679273 1024l678.958545 0C786.990545 1024 791.272727 1019.671273 791.272727 1014.225455L791.272727 149.410909C791.272727 144.011636 786.990545 139.636364 781.684364 139.636364L102.679273 139.636364C97.373091 139.636364 93.090909 143.965091 93.090909 149.410909zM139.636364 186.181818l605.090909 0 0 791.272727L139.636364 977.454545 139.636364 186.181818zM186.181818 279.272727l512 0 0 46.545455-512 0 0-46.545455ZM186.181818 418.909091l512 0 0 46.545455-512 0 0-46.545455ZM186.181818 558.545455l512 0 0 46.545455-512 0 0-46.545455Z" />
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
      <FileIcon
        fileName={normalizedFilename}
        fileExtension={normalizedExt}
        languageId={languageId}
        size={14}
        color="currentColor"
      />
    </span>
  );
};
