import React, { useState, useCallback } from 'react';
import type { SegmentChildRenderUnit } from '../utils/tool-pipeline';
import RenderUnitView from './RenderUnitView';
import ToolItemCard from './ToolItemCard';
import { IconBookOpen, IconSidebarTerminal } from './icons';

const IconPencil: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M5 19 L10 18 L19 9 a2.83 2.83 0 0 0 -4 -4 L6 14 Z" />
    <path d="M13 7 L17 11" />
  </svg>
);

interface CollapsedSegmentProps {
  units: SegmentChildRenderUnit[];
  summary: string;
}

function unitHasFileChange(unit: SegmentChildRenderUnit): boolean {
  if (unit.kind === 'entry') return unit.item.kind === 'write' || unit.item.kind === 'edit';
  return unit.items.some((item) => item.kind === 'write' || item.kind === 'edit');
}

function unitAllReads(unit: SegmentChildRenderUnit): boolean {
  if (unit.kind === 'entry') return unit.item.kind === 'read';
  return unit.items.every((item) => item.kind === 'read');
}

const CollapsedSegment: React.FC<CollapsedSegmentProps> = ({ units, summary }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const hasFileChange = units.some(unitHasFileChange);
  const allReads = units.length > 0 && units.every(unitAllReads);

  return (
    <div className="tool-item-shell w-full overflow-hidden">
      <button
        type="button"
        className="tool-item-row-surface group/summary-row flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left text-text-secondary transition-colors duration-150 hover:text-text-primary"
        onClick={toggle}
      >
        <span
          data-testid="collapsed-segment-icon"
          data-tool-icon={allReads ? 'book' : hasFileChange ? 'pencil' : 'terminal'}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-75"
        >
          {allReads ? <IconBookOpen size={15} className="text-current" /> : hasFileChange ? <IconPencil size={15} /> : <IconSidebarTerminal size={15} className="text-current" />}
        </span>
        <span className="truncate text-[13.5px] text-current">{summary}</span>
        <span className="shrink-0 text-current">
          {expanded ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </span>
      </button>

      {expanded && (
        <div className="ml-[25px] flex flex-col gap-0.5 pb-1 pt-0.5">
          {units.map((unit, i) => {
            if (unit.kind === 'exploration-group') {
              return unit.items.map((item) => (
                <ToolItemCard
                  key={`collapsed-exploration-${item.id}`}
                  item={item}
                  hideIcon
                />
              ));
            }
            return <RenderUnitView key={`collapsed-unit-${i}`} unit={unit} hideIcon />;
          })}
        </div>
      )}
    </div>
  );
};

export default CollapsedSegment;
