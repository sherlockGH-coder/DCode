import type { Message } from '../../../shared/types';
import type { RenderUnit } from './types';
import { extractToolItems, injectToolItems } from './extractToolItems';
import { splitBySegment } from './splitBySegment';
import { foldSegments } from './foldSegments';

export type { RenderUnit, SegmentChildRenderUnit } from './types';

export interface PipelineResult {
  units: RenderUnit[];
  /** message.id → renderUnit index 的映射（用于前端精确放置） */
  segmentMessageMap: Map<string, number>;
  /** message.id → tail renderUnit indexes；保留结构以兼容调用方。 */
  tailUnitsByMessageId: Map<string, number[]>;
}

function shouldRenderToolItem(item: { kind: string }): boolean {
  return item.kind !== 'vision' && item.kind !== 'task' && item.kind !== 'plan_update';
}

/** 完整管线: messages[] → PipelineResult */
export function pipeline(messages: Message[], isGenerating?: boolean): PipelineResult {

  const items = extractToolItems(messages).filter(shouldRenderToolItem);
  if (items.length === 0) return { units: [], segmentMessageMap: new Map(), tailUnitsByMessageId: new Map() };

  const tailUnitsByMessageId = new Map<string, number[]>();

  const injectedMessages = injectToolItems(messages).map((msg) => {
    if (msg.role === 'assistant' && msg.toolItems) {
      return {
        ...msg,
        toolItems: msg.toolItems.filter(shouldRenderToolItem),
      };
    }
    return msg;
  });

  const segments = splitBySegment(injectedMessages);

  const units = foldSegments(segments, isGenerating);
  if (units.length === 0) return { units: [], segmentMessageMap: new Map(), tailUnitsByMessageId: new Map() };

  const segIdxToUnitIdx = new Map<number, number>();
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    if (!segIdxToUnitIdx.has(unit.segmentIndex)) {
      segIdxToUnitIdx.set(unit.segmentIndex, i);
    }
  }

  const segmentMessageMap = new Map<string, number>();
  for (const segment of segments) {
    const unitIdx = segIdxToUnitIdx.get(segment.index);
    if (unitIdx !== undefined && segment.startMessageId) {
      segmentMessageMap.set(segment.startMessageId, unitIdx);
    }
  }

  return { units, segmentMessageMap, tailUnitsByMessageId };
}
