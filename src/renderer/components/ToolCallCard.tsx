import React, { useMemo, useState } from 'react';
import { IconChevronRight, IconPlug } from './icons';
import { ToolDetailFrame } from './tool-item-card/chrome';

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ToolCallCardProps {
  toolCalls: ToolCall[];
}

interface ParsedArgs {
  display: string;
  keys: string[];
}

function parseArgs(raw: string): ParsedArgs {
  try {
    const parsed = JSON.parse(raw);
    const display = JSON.stringify(parsed, null, 2);
    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed).slice(0, 4)
      : [];
    return { display, keys };
  } catch {
    return { display: raw, keys: [] };
  }
}

const ActiveToolCallRow: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [open, setOpen] = useState(false);
  const { display, keys } = useMemo(
    () => parseArgs(toolCall.function.arguments),
    [toolCall.function.arguments],
  );
  const isMcp = toolCall.function.name.startsWith('mcp__');
  const isFileMutation = toolCall.function.name === 'edit_file' || toolCall.function.name === 'write_file';

  return (
    <div className="w-full">
      <button
        type="button"
        data-testid="tool-call-row"
        onClick={() => setOpen((value) => !value)}
        className="tool-item-row-surface group/summary-row flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left text-text-secondary transition-colors duration-150"
        aria-expanded={open}
      >
        <span data-tool-icon={isMcp ? 'mcp' : 'running'} className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary opacity-90">
          {isMcp ? (
            <IconPlug size={14.5} className="text-current" />
          ) : (
            <svg className="animate-[ai-micro-spin_0.9s_linear_infinite]" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span data-testid="tool-call-name" className="shrink-0 font-mono text-[13.5px] text-text-secondary">
          {toolCall.function.name}
        </span>
        {keys.length > 0 && (
          <span className="flex min-w-0 items-center gap-1">
            {keys.map((key) => (
              <span key={key} className="truncate font-mono text-[12px] text-text-tertiary">
                {key}
              </span>
            ))}
          </span>
        )}
        <IconChevronRight
          size={12}
          className={`shrink-0 text-[10px] text-text-tertiary transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        isFileMutation ? (
          <pre
            data-testid="active-file-change-detail"
            className="ml-2 mt-0.5 max-h-[220px] overflow-auto whitespace-pre-wrap break-all pl-[25px] font-mono text-[12px] leading-relaxed text-text-tertiary"
          >
            {display}
          </pre>
        ) : (
          <ToolDetailFrame testId="active-tool-detail-frame" className="ml-2 mt-1 max-h-[220px] overflow-auto px-3 py-2">
            <pre className="m-0 whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-text-tertiary">{display}</pre>
          </ToolDetailFrame>
        )
      )}
    </div>
  );
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls }) => {
  return (
    <div className="my-1 flex max-w-[min(92%,760px)] flex-col gap-0.5">
      {toolCalls.map((toolCall) => (
        <ActiveToolCallRow key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
};

export default ToolCallCard;
