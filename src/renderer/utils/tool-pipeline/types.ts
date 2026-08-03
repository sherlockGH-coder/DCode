import type { ToolItem } from '../../../shared/types';

type EntryRenderUnit = { kind: 'entry'; item: ToolItem; segmentIndex: number };

type ExplorationGroupRenderUnit = {
  kind: 'exploration-group';
  items: ToolItem[];
  summary: string;
  segmentIndex: number;
  defaultCollapsed?: boolean;
};

/** Child units inside a segment must be leaf units to avoid nesting folded segments inside collapsed or expanded segments. */
export type SegmentChildRenderUnit = EntryRenderUnit | ExplorationGroupRenderUnit;

/** Render unit, the final pipeline output. */
export type RenderUnit =
  | SegmentChildRenderUnit
  | { kind: 'collapsed-segment'; units: SegmentChildRenderUnit[]; summary: string; segmentIndex: number }
  | { kind: 'expanded-segment'; units: SegmentChildRenderUnit[]; segmentIndex: number };

/** Segment, a ToolItem sequence split by assistant messages. */
export interface ToolSegment {
  index: number;
  items: ToolItem[];
  /** Assistant message ID that triggered the segment, used for renderer mapping. */
  startMessageId: string;
  /** Whether the assistant message immediately after this segment is the last one, which determines the folding strategy. */
  isLastSegment: boolean;
}

/** Aggregated summary data. */
export interface SegmentSummary {
  readCount: number;
  writeCount: number;
  editCount: number;
  execCount: number;
  grepCount: number;
  globCount: number;
  webSearchCount: number;
  webFetchCount: number;
  totalFiles: number;
  otherCount: number;
  hasRunning: boolean;
  hasError: boolean;
}
