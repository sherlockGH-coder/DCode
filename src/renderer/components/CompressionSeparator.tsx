import React, { useState } from 'react';
import { IconCompress, IconArchive, IconChevronDown, IconChevronRight } from './icons';

interface CompressionSeparatorProps {
  summary: string;
}

const CompressionSeparator: React.FC<CompressionSeparatorProps> = ({ summary }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-6 px-1 flex flex-col gap-3">
      {           }
      <div className="flex items-center gap-4 text-text-tertiary select-none">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex items-center gap-2 text-[12px] font-sans tracking-wide">
          <IconCompress size={14} className="text-accent/80" />
          <span>以上历史对话已被压缩 (Context Compressed)</span>
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {                                   }
      <div className="overflow-hidden transition-colors duration-150">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2.5 px-4 bg-transparent border-none text-left cursor-pointer hover:bg-black/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-accent/10 text-accent">
              <IconArchive size={12} />
            </span>
            <span className="text-[13px] font-medium text-text-secondary">查看先前对话历史摘要 (View Context Summary)</span>
          </div>
          <span className="text-text-tertiary">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-3.5 pt-1.5 border-t border-border/40 text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans bg-black/[0.01]">
            {summary}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompressionSeparator;
