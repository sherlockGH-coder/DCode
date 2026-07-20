import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToolItem } from '../../../shared/types';
import { IconCopy } from '../icons';
import { copyText, normalizeShellCommand } from './utils';

const ExecOutputPanel: React.FC<{ item: Extract<ToolItem, { kind: 'exec' }> }> = ({ item }) => {
  const output = item.output ?? '';
  const command = normalizeShellCommand(item.command);
  const exitCode = item.exitCode ?? (item.status === 'done' ? 0 : undefined);
  const [cmdCopied, setCmdCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const [commandExpanded, setCommandExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 2);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();
    const timer = setTimeout(checkScroll, 0);

    const handleScroll = () => {
      checkScroll();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [output, checkScroll]);

  const maskStyle = useMemo(() => {
    if (!canScrollUp && !canScrollDown) {
      return {};
    }
    if (canScrollUp && canScrollDown) {
      return {
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%)',
      };
    }
    if (canScrollUp) {
      return {
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black 100%)',
      };
    }
    return {
      WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 12px), transparent 100%)',
      maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 12px), transparent 100%)',
    };
  }, [canScrollUp, canScrollDown]);

  const handleCopyCommand = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyText(command);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2000);
  }, [command]);

  const handleCopyOutput = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyText(output);
    setOutputCopied(true);
    setTimeout(() => setOutputCopied(false), 2000);
  }, [output]);

  const isLongCommand = command.length > 100;
  const displayCommand = isLongCommand && !commandExpanded
    ? command.slice(0, 100)
    : command;

  return (
    <div
      data-testid="exec-output-panel"
      className="relative rounded-[10px] bg-bg-block overflow-hidden text-text-secondary select-text flex flex-col"
    >
      <div className="group/cmd-section relative pt-2.5 px-3 select-text shrink-0 z-10">
        <div className="text-[12.5px] font-medium text-text-secondary mb-1 select-none">
          Shell
        </div>

        <div
          className={`font-mono text-[12.5px] text-text-primary whitespace-pre-wrap break-all leading-[1.6] pr-8 ${
            isLongCommand ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (isLongCommand) setCommandExpanded((v) => !v);
          }}
        >
          $ {displayCommand}
          {isLongCommand && !commandExpanded && (
            <span data-testid="command-ellipsis" className="inline-block pr-[0.16em] font-bold tracking-[-0.16em] text-current cursor-pointer select-none">
              ...
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="copy-command-btn"
          title="复制命令"
          className="absolute right-3.5 top-8 inline-flex h-6 w-6 items-center justify-center text-text-tertiary hover:text-text-primary transition-all cursor-pointer opacity-0 group-hover/cmd-section:opacity-100"
          onClick={handleCopyCommand}
        >
          {cmdCopied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-diff-add">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <IconCopy size={13} />
          )}
        </button>
      </div>

      {output && (
        <div className="group/output-section relative flex-1 min-h-0">
          <div
            ref={containerRef}
            className="overflow-auto max-h-[320px] px-3 custom-scrollbar"
            style={maskStyle}
          >
            <pre className="m-0 mt-1 pb-4 whitespace-pre font-mono text-[12.5px] leading-[1.75] text-text-secondary overflow-visible">
              {output}
            </pre>
          </div>

          <button
            type="button"
            data-testid="exec-output-copy"
            title="复制输出结果"
            className="absolute right-3.5 top-0.5 z-20 inline-flex h-6 w-6 items-center justify-center text-text-tertiary hover:text-text-primary transition-all cursor-pointer opacity-0 group-hover/output-section:opacity-100"
            onClick={handleCopyOutput}
          >
            {outputCopied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-diff-add">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <IconCopy size={13} />
            )}
          </button>
        </div>
      )}

      {exitCode !== undefined && exitCode !== 0 && (
        <div className="px-3 pb-2 pt-1 text-[12px] font-medium text-diff-del select-none shrink-0 text-right z-20 flex items-center justify-end gap-0.5">
          退出码 {exitCode}
        </div>
      )}
    </div>
  );
};

export default ExecOutputPanel;
