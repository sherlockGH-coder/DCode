import React from 'react';
import type { SlashCommand } from './utils';

const SlashCommandMenu: React.FC<{
  open: boolean;
  filter: string;
  index: number;
  filteredCommands: SlashCommand[];
  builtinFiltered: SlashCommand[];
  skillFiltered: SlashCommand[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onHoverIndex: React.Dispatch<React.SetStateAction<number>>;
  onSelect: (cmd: SlashCommand) => void;
}> = ({
  open,
  filter,
  index,
  filteredCommands,
  builtinFiltered,
  skillFiltered,
  scrollContainerRef,
  onHoverIndex,
  onSelect,
}) => (
  <>
    {open && filteredCommands.length > 0 && (
      <div
        className="absolute bottom-full left-0 right-0 mb-2 bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-hidden z-50 animate-[menu-in_150ms_ease-out]"
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline">
          <span className="text-[12px] font-normal text-text-tertiary select-none">
            命令
          </span>
          {filter && (
            <span className="text-[11px] text-text-tertiary">
              匹配 "{filter}"
            </span>
          )}
        </div>

        <div ref={scrollContainerRef} className="max-h-[220px] overflow-y-auto custom-scrollbar py-1.5 px-1.5">
          {builtinFiltered.length > 0 && (
            <>
              <div className="px-2.5 py-1 text-[12px] font-normal text-text-tertiary select-none">
                系统命令
              </div>
              {builtinFiltered.map((cmd) => (
                <SlashCommandRow
                  key={cmd.name}
                  cmd={cmd}
                  globalIdx={filteredCommands.indexOf(cmd)}
                  selectedIndex={index}
                  onHoverIndex={onHoverIndex}
                  onSelect={onSelect}
                />
              ))}
            </>
          )}

          {skillFiltered.length > 0 && (
            <>
              <div className="px-2.5 py-1 mt-1 text-[12px] font-normal text-text-tertiary select-none">
                技能
              </div>
              {skillFiltered.map((cmd) => (
                <SlashCommandRow
                  key={cmd.name}
                  cmd={cmd}
                  globalIdx={filteredCommands.indexOf(cmd)}
                  selectedIndex={index}
                  onHoverIndex={onHoverIndex}
                  onSelect={onSelect}
                />
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-hairline text-[11px] text-text-tertiary select-none">
          输入 <code className="px-1 py-0.5 bg-bg-chip rounded-[5px] text-[10px] font-mono">/</code> 触发命令面板 · 输入关键词筛选
        </div>
      </div>
    )}
  </>
);

const SlashCommandRow: React.FC<{
  cmd: SlashCommand;
  globalIdx: number;
  selectedIndex: number;
  onHoverIndex: React.Dispatch<React.SetStateAction<number>>;
  onSelect: (cmd: SlashCommand) => void;
}> = ({ cmd, globalIdx, selectedIndex, onHoverIndex, onSelect }) => {
  const isSelected = globalIdx === selectedIndex;
  return (
    <button
      type="button"
      data-selected={isSelected}
      className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 text-left rounded-[7px] border-none transition-colors duration-150 cursor-pointer ${
        isSelected
          ? 'bg-accent-bg'
          : 'bg-transparent hover:bg-bg-hover'
      }`}
      onMouseEnter={() => onHoverIndex(globalIdx)}
      onClick={() => onSelect(cmd)}
    >
      <div className="flex items-center justify-center w-5 h-5 shrink-0 text-text-secondary">
        {cmd.icon}
      </div>
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        <span className={`text-[13px] font-medium leading-none shrink-0 ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
          {cmd.name}
        </span>
        <span className="text-text-tertiary text-[11.5px] truncate leading-none">
          {cmd.description}
        </span>
      </div>
      {isSelected && (
        <kbd className="ml-1 shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] bg-bg-chip text-[10px] font-medium text-text-tertiary select-none">
          ↵
        </kbd>
      )}
    </button>
  );
};

export default SlashCommandMenu;
