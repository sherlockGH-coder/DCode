import type { ToolItem } from '../../../shared/types';

export type EntryRenderUnit = { kind: 'entry'; item: ToolItem; segmentIndex: number };

export type ExplorationGroupRenderUnit = {
  kind: 'exploration-group';
  items: ToolItem[];
  summary: string;
  segmentIndex: number;
  defaultCollapsed?: boolean;
};

/** 段内子单元必须是叶子单元，避免 collapsed/expanded 内再次嵌套折叠段。 */
export type SegmentChildRenderUnit = EntryRenderUnit | ExplorationGroupRenderUnit;

/** 渲染单元 — 管线最终输出 */
export type RenderUnit =
  | SegmentChildRenderUnit
  | { kind: 'collapsed-segment'; units: SegmentChildRenderUnit[]; summary: string; segmentIndex: number }
  | { kind: 'expanded-segment'; units: SegmentChildRenderUnit[]; segmentIndex: number };

/** 段 — 按 assistant-message 切分的 ToolItem 序列 */
export interface ToolSegment {
  index: number;
  items: ToolItem[];
  /** 触发该段的 assistant 消息 ID（用于前端映射） */
  startMessageId: string;
  /** 该段后面紧跟的 assistant 消息是否是最后一条（决定折叠策略） */
  isLastSegment: boolean;
}

/** 聚合摘要数据 */
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
