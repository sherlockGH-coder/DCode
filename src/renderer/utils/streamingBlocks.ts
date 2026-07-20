const FENCE_RE = /^ {0,3}(```|~~~)/;
const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/;
const INDENT_CONTINUATION_RE = /^ {4,}\S/;

/** 段落末尾（忽略尾随空行）是否为列表项，用于判断松散列表续块 */
function endsWithListItem(block: string): boolean {
  const lines = block.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    return LIST_ITEM_RE.test(line) || /^ {2,}\S/.test(line);
  }
  return false;
}

export function splitBlocks(text: string): string[] {
  if (!text) return [];

  const lines = text.split('\n');
  const rawBlocks: string[] = [];
  let current: string[] = [];
  let fenceMarker: string | null = null;

  const flush = () => {
    if (current.length === 0) return;
    rawBlocks.push(current.join('\n'));
    current = [];
  };

  let pendingBlanks = 0;
  for (const line of lines) {
    if (fenceMarker) {
      current.push(line);
      const match = line.match(FENCE_RE);
      if (match && match[1][0] === fenceMarker[0] && match[1].length >= fenceMarker.length) {
        fenceMarker = null;
      }
      continue;
    }

    if (!line.trim()) {

      if (current.length > 0) pendingBlanks++;
      continue;
    }

    if (pendingBlanks > 0) {
      flush();
      pendingBlanks = 0;
    }

    const match = line.match(FENCE_RE);
    if (match) fenceMarker = match[1];
    current.push(line);
  }
  flush();

  if (rawBlocks.length === 0) return [];

  const merged: string[] = [rawBlocks[0]];
  for (let i = 1; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const prev = merged[merged.length - 1];
    const isContinuation =
      (LIST_ITEM_RE.test(block) && endsWithListItem(prev)) ||
      INDENT_CONTINUATION_RE.test(block);
    if (isContinuation) {
      merged[merged.length - 1] = `${prev}\n\n${block}`;
    } else {
      merged.push(block);
    }
  }

  return merged;
}
