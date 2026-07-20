import type { ContentDiffLine, DiffLine } from './types';

const DEFAULT_CONTEXT_LINES = 1;

export function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];

  let oldLineNum = 1;
  let newLineNum = 1;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === '' && i === lines.length - 1) {
      continue;
    }

    const hunkMatch = raw.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)/);
    if (hunkMatch) {
      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[2], 10);
      inHunk = true;
      result.push({
        type: 'hunk',
        text: raw,
        oldStart: oldLineNum,
        newStart: newLineNum,
      });
      continue;
    }

    if (!inHunk) {
      result.push({ type: 'meta', text: raw });
      continue;
    }

    if (
      raw.startsWith('diff --') ||
      raw.startsWith('--- ') ||
      raw.startsWith('+++ ') ||
      raw.startsWith('index ')
    ) {
      inHunk = false;
      result.push({ type: 'meta', text: raw });
      continue;
    }

    const h = raw.charAt(0);
    if (h === '+') {
      result.push({ type: 'add', text: raw.slice(1), newLineNum: newLineNum++ });
    } else if (h === '-') {
      result.push({ type: 'del', text: raw.slice(1), oldLineNum: oldLineNum++ });
    } else if (h === ' ') {
      result.push({
        type: 'ctx',
        text: raw.slice(1),
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    } else {
      result.push({
        type: 'ctx',
        text: raw,
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    }
  }

  return result;
}

function hasRenderedContent(lines: DiffLine[]): boolean {
  return lines.some((line) => line.type === 'add' || line.type === 'del' || line.type === 'ctx');
}

function appendCompactSegment(result: DiffLine[], segment: ContentDiffLine[], contextLines: number): void {
  if (segment.length === 0) return;

  const changedIndexes = segment
    .map((line, index) => (line.type === 'add' || line.type === 'del' ? index : -1))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) return;

  const keepIndexes = new Set<number>();
  for (const index of changedIndexes) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(segment.length - 1, index + contextLines);
    for (let i = start; i <= end; i++) {
      keepIndexes.add(i);
    }
  }

  let emittedInSegment = false;
  let skippedSinceLastEmit = false;

  for (let i = 0; i < segment.length; i++) {
    if (!keepIndexes.has(i)) {
      skippedSinceLastEmit = true;
      continue;
    }

    if (skippedSinceLastEmit && (emittedInSegment || hasRenderedContent(result))) {
      result.push({ type: 'gap' });
    }

    result.push(segment[i]);
    emittedInSegment = true;
    skippedSinceLastEmit = false;
  }
}

export function compactDiffLines(lines: DiffLine[], contextLines = DEFAULT_CONTEXT_LINES): DiffLine[] {
  const result: DiffLine[] = [];
  let segment: ContentDiffLine[] = [];

  const flushSegment = () => {
    appendCompactSegment(result, segment, contextLines);
    segment = [];
  };

  for (const line of lines) {
    if (line.type === 'add' || line.type === 'del' || line.type === 'ctx') {
      segment.push(line);
      continue;
    }

    flushSegment();

    if (line.type === 'meta') {
      result.push(line);
    }
  }

  flushSegment();

  return result;
}
