import React from 'react';
import { IconChevronRight, IconDeepThinking } from '../icons';

const ReasoningPanel: React.FC<{
  completedAt?: number;
  duration?: number;
  isGenerating: boolean;
  isExpanded: boolean;
  onExpandedChange: React.Dispatch<React.SetStateAction<boolean>>;
  reasoningContent?: string;
  thinkingEnd: number | null;
}> = ({
  completedAt,
  duration,
  isGenerating,
  isExpanded,
  onExpandedChange,
  reasoningContent,
  thinkingEnd,
}) => (
  <div className="w-full relative z-10">
    <button
      type="button"
      className="flex items-center gap-1.5 cursor-pointer border-none bg-transparent font-[inherit] py-1 select-none group"
      onClick={() => onExpandedChange(!isExpanded)}
    >
      {isGenerating && !thinkingEnd && !completedAt && duration === undefined ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-4 h-4 shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent animate-thinking-pulse"></span>
          </div>
          <span className="text-[13.5px] font-normal text-accent">
            正在深度思考
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <IconDeepThinking size={15} className="shrink-0 text-text-secondary group-hover:text-text-primary transition-colors" />
          <span className="text-[13.5px] font-normal text-text-secondary group-hover:text-text-primary transition-colors">
            已深度思考
          </span>
        </div>
      )}
      <IconChevronRight
        size={12}
        className={`text-text-tertiary group-hover:text-text-primary transition-transform duration-[180ms] ${isExpanded ? 'rotate-90' : ''}`}
      />
    </button>
    {isExpanded && (
      <div className="pl-4 border-l border-hairline text-[14px] text-text-tertiary leading-[1.7] whitespace-pre-wrap break-words mt-1 max-h-[500px] overflow-y-auto">
        {reasoningContent}
      </div>
    )}
  </div>
);

export default ReasoningPanel;
