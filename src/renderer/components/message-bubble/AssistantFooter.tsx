import React from 'react';
import { formatCompletedAt } from '../../utils/messageTime';
import { IconCheck, IconChevronLeft, IconChevronRight, IconCopy, IconDots } from '../icons';

const AssistantFooter: React.FC<{
  completedAtMs: number | null | undefined;
  copied: boolean;
  copyContent: string | null | undefined;
  isMenuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCopyMarkdown: () => Promise<void>;
  onCopyText: () => Promise<void>;
  onMenuOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onResponseNext?: () => void;
  onResponsePrev?: () => void;
  responseCurrent?: number;
  responseTotal?: number;
  visibilityClass: string;
}> = ({
  completedAtMs,
  copied,
  copyContent,
  isMenuOpen,
  menuRef,
  onCopyMarkdown,
  onCopyText,
  onMenuOpenChange,
  onResponseNext,
  onResponsePrev,
  responseCurrent,
  responseTotal,
  visibilityClass,
}) => (
  <div className={`flex items-center justify-between mt-1.5 ${visibilityClass} transition-opacity duration-200 w-full`}>
    <div className="flex items-center gap-2">
      {completedAtMs && (
        <span className="text-[12px] text-text-tertiary font-normal select-none">
          {formatCompletedAt(completedAtMs)}
        </span>
      )}
      {responseTotal && responseTotal > 1 && (
        <div className="flex items-center gap-0.5 ml-1 text-[12px] text-text-tertiary select-none">
          <button
            type="button"
            className="flex items-center justify-center w-5.5 h-5.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors duration-150 border-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-default"
            onClick={onResponsePrev}
            disabled={responseCurrent !== undefined && responseCurrent <= 1}
            title="上一个回复"
          >
            <IconChevronLeft size={13} />
          </button>
          <span className="px-0.5 tabular-nums font-medium">{responseCurrent}/{responseTotal}</span>
          <button
            type="button"
            className="flex items-center justify-center w-5.5 h-5.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors duration-150 border-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-default"
            onClick={onResponseNext}
            disabled={responseCurrent !== undefined && responseTotal !== undefined && responseCurrent >= responseTotal}
            title="下一个回复"
          >
            <IconChevronRight size={13} />
          </button>
        </div>
      )}
    </div>

    <div className="relative shrink-0 flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => onMenuOpenChange(!isMenuOpen)}
        className="flex items-center justify-center w-7 h-7 rounded-[7px] hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors duration-150 border-none bg-transparent cursor-pointer"
        title="更多操作"
      >
        {copied ? <IconCheck size={16} className="text-accent shrink-0" /> : <IconDots size={16} className="shrink-0" />}
      </button>

      {isMenuOpen && (
          <div
            className="absolute bottom-full right-0 z-50 mb-1.5 min-w-[140px] bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-hidden py-1 animate-[menu-in_150ms_ease-out]"
          >
            <button
              type="button"
              disabled={!copyContent}
              onClick={async () => {
                onMenuOpenChange(false);
                await onCopyText();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-text-primary hover:bg-bg-hover border-none bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconCopy size={13} className="text-text-secondary shrink-0" />
              <span>复制纯文本</span>
            </button>
            <button
              type="button"
              disabled={!copyContent}
              onClick={async () => {
                onMenuOpenChange(false);
                await onCopyMarkdown();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-text-primary hover:bg-bg-hover border-none bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="13" height="13" viewBox="0 0 1024 1024" fill="currentColor" className="text-text-secondary shrink-0" aria-hidden>
                <path d="M128 128h768a42.666667 42.666667 0 0 1 42.666667 42.666667v682.666666a42.666667 42.666667 0 0 1-42.666667 42.666667H128a42.666667 42.666667 0 0 1-42.666667-42.666667V170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667z m42.666667 85.333333v597.333334h682.666666V213.333333H170.666667z m128 448H213.333333v-298.666666h85.333334l85.333333 85.333333 85.333333-85.333333h85.333334v298.666666h-85.333334v-170.666666l-85.333333 85.333333-85.333333-85.333333v170.666666z m469.333333-128h85.333333l-128 128-128-128h85.333334v-170.666666h85.333333v170.666666z" />
              </svg>
              <span>复制 Markdown</span>
            </button>
          </div>
      )}
    </div>
  </div>
);

export default AssistantFooter;
