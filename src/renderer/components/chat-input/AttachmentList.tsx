import React from 'react';
import type { Attachment } from '../../../shared/types';
import { attachmentWarning, formatBytes, kindIcon } from './utils';

const AttachmentList: React.FC<{
  attachments: Attachment[];
  imageAttachments: Attachment[];
  fileAttachments: Attachment[];
  onRemove: (id: string) => void;
}> = ({ attachments, imageAttachments, fileAttachments, onRemove }) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-6 pt-3 pb-2 mb-2 border border-border/40 dark:border-white/[0.08] rounded-xl bg-bg-sidebar/30 dark:bg-white/[0.02]">
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {imageAttachments.map((a) => {
            const warn = attachmentWarning(a);
            return (
              <div
                key={a.id}
                title={warn ? `${a.path}\n⚠ ${warn}` : a.path}
                className="relative group w-[84px] h-[84px] rounded-xl border border-border bg-white dark:bg-[#1a1a1c] shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-accent/30 shrink-0"
              >
                <img
                  src={`local-file://${a.path}`}
                  alt={a.name}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center cursor-pointer border-none bg-black/50 hover:bg-black/70 text-white rounded-full text-[11px] font-bold shadow transition-all duration-200 hover:scale-110"
                  onClick={() => onRemove(a.id)}
                  aria-label={`移除 ${a.name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((a) => {
            const warn = attachmentWarning(a);
            return (
              <div
                key={a.id}
                title={warn ? `${a.path}\n⚠ ${warn}` : a.path}
                className={`inline-flex items-center gap-2 py-1.5 px-3 max-w-[260px] border rounded-xl text-[12px] shadow-sm transition-all ${
                  warn
                    ? 'bg-[#fff5e6] dark:bg-[#3d2711] border-[#f5b97a] dark:border-[#a16224] text-[#8a4a00] dark:text-[#ffd699]'
                    : 'bg-white dark:bg-[#1a1a1c] border-border text-text-primary'
                }`}
              >
                <span aria-hidden className="opacity-80 text-[13px] shrink-0">
                  {warn ? '⚠' : kindIcon(a.kind)}
                </span>
                <span className="truncate font-medium max-w-[100px] sm:max-w-[160px]">
                  {a.name}
                </span>
                <span
                  className={`text-[11px] shrink-0 opacity-60 ${
                    warn ? 'text-[#8a4a00] dark:text-[#ffd699]' : 'text-text-tertiary'
                  }`}
                >
                  {formatBytes(a.size)}
                </span>
                <button
                  type="button"
                  className={`ml-1 w-4 h-4 inline-flex items-center justify-center cursor-pointer border-none bg-black/5 dark:bg-white/10 rounded-full text-[12px] transition-all ${
                    warn
                      ? 'text-[#8a4a00] dark:text-[#ffd699] hover:bg-[#f5b97a]/30'
                      : 'text-text-tertiary hover:bg-black/10 dark:hover:bg-white/20 hover:text-text-primary'
                  }`}
                  onClick={() => onRemove(a.id)}
                  aria-label={`移除 ${a.name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttachmentList;
