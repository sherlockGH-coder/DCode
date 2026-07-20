import type { ToolItem } from '../../../shared/types';
import type { SegmentChildRenderUnit } from './types';

/** 判断是否为只读探索工具（不包含 read，read 作为独立项展示） */
function isExploration(item: ToolItem): boolean {
  return item.kind === 'grep'
    || item.kind === 'glob'
    || item.kind === 'list_directory'
    || item.kind === 'web_search'
    || item.kind === 'web_fetch';
}

function joinSummaryParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? 'Explored';
  if (parts.length === 2) return `${parts[0]}和${parts[1]}`;
  return `${parts.slice(0, -1).join('、')}和${parts[parts.length - 1]}`;
}

function formatExplorationSummary(items: ToolItem[]): string {
  const readCount = items.filter((item) => item.kind === 'read').length;
  const searchCount = items.filter((item) => item.kind === 'grep').length;
  const listedCount = items.filter((item) => item.kind === 'glob' || item.kind === 'list_directory').length;
  const webCount = items.filter((item) => item.kind === 'web_search' || item.kind === 'web_fetch').length;
  const parts: string[] = [];

  if (readCount === 1) parts.push('Read a file');
  else if (readCount > 1) parts.push(`Read ${readCount} files`);
  if (searchCount > 0) parts.push(`已搜索 ${searchCount} 次`);
  if (listedCount > 0) parts.push('已列出文件');
  if (webCount > 0) parts.push(`已搜索网页 ${webCount} 次`);

  return joinSummaryParts(parts);
}

export function groupExploration(items: ToolItem[], segmentIndex: number): SegmentChildRenderUnit[] {
  const units: SegmentChildRenderUnit[] = [];
  let explorationBuffer: ToolItem[] = [];

  const flushExploration = () => {
    if (explorationBuffer.length === 0) return;
    if (explorationBuffer.length === 1) {

      units.push({ kind: 'entry', item: explorationBuffer[0], segmentIndex });
    } else {
      units.push({
        kind: 'exploration-group',
        items: explorationBuffer,
        summary: formatExplorationSummary(explorationBuffer),
        segmentIndex,
      });
    }
    explorationBuffer = [];
  };

  for (const item of items) {
    if (isExploration(item)) {
      explorationBuffer.push(item);
    } else {
      flushExploration();
      units.push({ kind: 'entry', item, segmentIndex });
    }
  }
  flushExploration();

  return units;
}
