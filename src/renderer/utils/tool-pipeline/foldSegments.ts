import type { RenderUnit, ToolSegment } from './types';
import { groupExploration } from './groupExploration';
import { aggregateSummary } from './aggregateSummary';

/** Whether every item in a segment is complete, with no running or pending state. */
function isSegmentComplete(segment: ToolSegment): boolean {
  return segment.items.every((item) => item.status === 'done' || item.status === 'error');
}

export function foldSegments(segments: ToolSegment[], isGenerating?: boolean): RenderUnit[] {
  const result: RenderUnit[] = [];

  for (const segment of segments) {

    const allGrouped = groupExploration(segment.items, segment.index);

    // Plan archive cards always render independently and are not folded.
    const planUnits = allGrouped.filter((unit) => unit.kind === 'entry' && unit.item.kind === 'plan_artifact');
    const grouped = planUnits.length ? allGrouped.filter((unit) => !planUnits.includes(unit)) : allGrouped;
    const foldableItems = planUnits.length
      ? segment.items.filter((item) => item.kind !== 'plan_artifact')
      : segment.items;

    if (grouped.length === 1 && grouped[0].kind === 'entry') {
      result.push(grouped[0]);
      result.push(...planUnits);
      continue;
    }

    if (grouped.length === 1 && grouped[0].kind === 'exploration-group') {
      const isComplete = isSegmentComplete(segment);
      const isLast = segment.isLastSegment;
      const shouldCollapse = isComplete && !(isLast && isGenerating);
      result.push({
        ...grouped[0],
        defaultCollapsed: shouldCollapse,
      });
      result.push(...planUnits);
      continue;
    }

    if (grouped.length === 0) {
      result.push(...planUnits);
      continue;
    }

    const isComplete = isSegmentComplete(segment);
    const isLast = segment.isLastSegment;

    if (!isComplete) {

      result.push({ kind: 'expanded-segment', units: grouped, segmentIndex: segment.index });
    } else if (isLast && isGenerating) {

      result.push({ kind: 'expanded-segment', units: grouped, segmentIndex: segment.index });
    } else {

      const summary = aggregateSummary(foldableItems);
      result.push({ kind: 'collapsed-segment', units: grouped, summary, segmentIndex: segment.index });
    }
    result.push(...planUnits);
  }

  return result;
}
