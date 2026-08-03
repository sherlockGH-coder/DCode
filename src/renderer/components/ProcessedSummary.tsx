import React, { useEffect, useRef, useState } from 'react';
import { IconChevronRight } from './icons';

interface Props {
  isProcessing: boolean;
  /** Used only in processing mode: timestamp when the first token arrives. */
  startedAt?: number;
  /** Used only in completed mode: final duration in milliseconds. */
  durationMs?: number;
  /** Intermediate nodes: rendered below the separator when completed and expanded; laid out below by the parent while processing. */
  children?: React.ReactNode;
  /** Whether intermediate activity exists, which determines whether completed mode has an expand button. */
  hasIntermediate: boolean;
  /** Whether to expand by default after completion; collapsed by default. */
  defaultExpanded?: boolean;
}

/** Compact duration: < 60s -> "12s", < 1h -> "3m 2s", otherwise "1h 5m 30s". */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m ${s}s`;
}

const ProcessedSummary: React.FC<Props> = ({
  isProcessing,
  startedAt,
  durationMs,
  children,
  hasIntermediate,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(() => isProcessing || defaultExpanded);
  const [, setTick] = useState(0);
  const wasProcessing = useRef(isProcessing);

  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);

  useEffect(() => {
    if (isProcessing) {
      setExpanded(true);
    } else if (wasProcessing.current) {
      setExpanded(false);
    }
    wasProcessing.current = isProcessing;
  }, [isProcessing]);

  const elapsedMs = isProcessing && startedAt
    ? Date.now() - startedAt
    : (durationMs ?? 0);

  const canToggle = hasIntermediate;
  const effectiveExpanded = isProcessing ? true : expanded;

  return (
    <div className="agent-process-summary assistant-message-inset mt-0 -mb-1">
      <button
        type="button"
        data-testid="processed-summary-toggle"
        aria-expanded={canToggle ? effectiveExpanded : undefined}
        disabled={!canToggle}
        onClick={canToggle && !isProcessing ? () => setExpanded((v) => !v) : undefined}
        className={`inline-flex items-center gap-1.5 select-none group py-0.5 transition-colors duration-200 ${
          canToggle && !isProcessing ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className="flex items-center gap-1 text-[13.5px] text-text-secondary group-hover:text-text-primary transition-colors">
          {isProcessing && (
            <svg className="animate-[ai-micro-spin_0.9s_linear_infinite] text-accent shrink-0 mr-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          <span className="font-medium">Processed</span>
          <span className="font-medium tabular-nums ml-0.5">{formatDuration(elapsedMs)}</span>
        </span>

        {canToggle && (
          <IconChevronRight
            size={11}
            className={`text-text-secondary group-hover:text-text-primary transition-transform duration-200 ml-0.5 ${
              effectiveExpanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>

      {hasIntermediate && effectiveExpanded && (
        <hr className="my-1.5 border-t border-hairline" />
      )}

      {hasIntermediate && effectiveExpanded && children && (
        <div data-testid="processed-summary-content" className="mt-0.5 flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
};

export default ProcessedSummary;
