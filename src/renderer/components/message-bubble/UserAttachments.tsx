import React from 'react';
import type { Attachment } from '../../../shared/types';
import { formatBytes, kindIcon } from './utils';

const UserAttachments: React.FC<{
  fileAttachments: Attachment[];
  imageAttachments: Attachment[];
  onLocalFileClick: (href: string, event: React.MouseEvent) => void;
}> = ({ fileAttachments, imageAttachments, onLocalFileClick }) => (
  <div className="flex flex-col gap-2 mb-2 items-end max-w-[min(85%,720px)]">
    {imageAttachments.length > 0 && (
      <div className="flex flex-wrap gap-3 justify-end">
        {imageAttachments.map((attachment) => (
          <div
            key={attachment.id}
            title={attachment.path}
            className="relative group w-[84px] h-[84px] rounded-[10px] border border-hairline bg-bg-block overflow-hidden transition-colors duration-150 shrink-0 cursor-pointer"
            onClick={(event) => onLocalFileClick(attachment.path, event)}
          >
            <img
              src={`local-file://${attachment.path}`}
              alt={attachment.name}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          </div>
        ))}
      </div>
    )}

    {fileAttachments.length > 0 && (
      <div className="flex flex-wrap gap-1.5 justify-end">
        {fileAttachments.map((attachment) => (
          <div
            key={attachment.id}
            title={attachment.path}
            className="inline-flex items-center gap-1.5 py-1 px-2.5 max-w-[260px] bg-bg-chip border border-hairline rounded-[7px] text-[12px] text-text-primary"
          >
            <span aria-hidden className="opacity-80 text-[13px] shrink-0">
              {kindIcon(attachment.kind)}
            </span>
            <span className="truncate" style={{ maxWidth: 160 }}>
              {attachment.name}
            </span>
            <span className="text-text-tertiary text-[11px] shrink-0">
              {formatBytes(attachment.size)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default UserAttachments;
