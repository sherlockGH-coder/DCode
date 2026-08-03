interface DiffEntry {
  type: 'add' | 'del' | 'ctx';
  text: string;
}

/**
 * Generate an LCS-based line diff between two text blocks.
 * Return a unified-diff string with an @@ header followed by lines starting with ' ', '+', or '-'.
 *
 * @param oldStartLine Starting line number of oldText in the original file, 1-based.
 * @param newStartLine Starting line number of newText in the target file, 1-based.
 */
export function buildLineDiff(
  oldText: string,
  newText: string,
  oldStartLine = 1,
  newStartLine = 1,
): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const entries: DiffEntry[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      entries.push({ type: 'ctx', text: oldLines[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      entries.push({ type: 'del', text: oldLines[i - 1] });
      i--;
    } else {
      entries.push({ type: 'add', text: newLines[j - 1] });
      j--;
    }
  }
  while (i > 0) { entries.push({ type: 'del', text: oldLines[i - 1] }); i--; }
  while (j > 0) { entries.push({ type: 'add', text: newLines[j - 1] }); j--; }
  entries.reverse();

  const header = `@@ -${oldStartLine},${m} +${newStartLine},${n} @@`;

  return header + '\n' + entries.map((e) => {
    const prefix = e.type === 'add' ? '+' : e.type === 'del' ? '-' : ' ';
    return prefix + e.text;
  }).join('\n');
}

/** Treat the entire block as added, used for a new file write. */
export function buildAllAddedDiff(text: string, startLine = 1): string {
  const lines = text.split('\n');
  const header = `@@ -0,0 +${startLine},${lines.length} @@`;
  return header + '\n' + lines.map((line) => '+' + line).join('\n');
}
