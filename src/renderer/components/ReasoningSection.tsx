import React, { useState } from 'react';
import { IconChevronRight, IconDeepThinking } from './icons';

interface Props {
  reasoningContent: string;
  /** 思考时长（秒）；可选 */
  durationSecs?: number;
  /** 默认是否展开（默认收起，跟随 ProcessedSummary 默认收起的语义） */
  defaultExpanded?: boolean;
}

const ReasoningSection: React.FC<Props> = ({ reasoningContent, durationSecs, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const title = durationSecs && durationSecs > 0 ? `已深度思考（${durationSecs} 秒）` : '已深度思考';

  return (
    <div className="w-full relative z-10">
      <button
        type="button"
        className="flex items-center gap-1.5 cursor-pointer border-none bg-transparent font-[inherit] py-1 select-none group"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-1.5">
          <IconDeepThinking size={14} className="shrink-0 text-text-tertiary group-hover:text-accent transition-colors" />
          <span className="text-[13.5px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors">
            {title}
          </span>
        </div>
        <IconChevronRight
          size={12}
          className={`text-text-tertiary group-hover:text-text-primary transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="pl-4 border-l border-border/40 text-[14px] text-text-tertiary leading-[1.7] whitespace-pre-wrap mt-1 max-h-[500px] overflow-y-auto">
          {reasoningContent}
        </div>
      )}
    </div>
  );
};

export default ReasoningSection;
