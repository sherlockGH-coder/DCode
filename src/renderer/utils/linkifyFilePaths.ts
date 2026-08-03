import { collapsePath, getPathContext } from './collapsePath';

/** Escape regular-expression special characters. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check whether a path is within an allowed root, either cwd or home. */
function isAllowedPath(absolutePath: string): boolean {
  const { cwd, home } = getPathContext();

  if (cwd && absolutePath.startsWith(cwd)) return true;
  if (home && absolutePath.startsWith(home)) return true;
  return false;
}

/**
 * Convert absolute paths under cwd or home into Markdown links.
 *
 * Safety rules:
 * - Skip paths inside code blocks (```...```).
 * - Skip paths that are already Markdown links.
 * - Preserve line-number suffixes such as :42.
 */
export function linkifyFilePaths(text: string): string {
  if (!text) return text;

  const { cwd, home } = getPathContext();
  if (!cwd && !home) return text;

  const segments: { kind: 'text' | 'code'; content: string }[] = [];
  const codeBlockRe = /(`{3,})[\s\S]*?\1|`[^`\n]*`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ kind: 'text', content: text.slice(lastIdx, m.index) });
    }
    segments.push({ kind: 'code', content: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    segments.push({ kind: 'text', content: text.slice(lastIdx) });
  }

  const prefixes: { prefix: string; escaped: string }[] = [];
  if (cwd) prefixes.push({ prefix: cwd, escaped: escapeRegExp(cwd) });
  if (home) prefixes.push({ prefix: home, escaped: escapeRegExp(home) });

  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);

  for (const seg of segments) {
    if (seg.kind !== 'text') continue;

    for (const { prefix, escaped } of prefixes) {

      const pathRe = new RegExp(
        `(?<!(?:\\]\\(|\\[))${escaped}(/[^\\s\`\\)\\]<>"'{}\\u0000-\\u001F]*(?:\\.[a-zA-Z]\\w*)?)(:\\d+)?(?!(?:[^\\[]*\\]\\([^)]*\\)|[^(]*\\)))`,
        'g',
      );

      seg.content = seg.content.replace(pathRe, (_fullMatch, pathSuffix, lineNum) => {
        const absolutePath = prefix + pathSuffix;

        if (!isAllowedPath(absolutePath)) {
          return _fullMatch;
        }
        const displayPath = collapsePath(absolutePath) + (lineNum || '');

        return `[${displayPath}](${absolutePath}${lineNum || ''})`;
      });
    }
  }

  return segments.map((s) => s.content).join('');
}
