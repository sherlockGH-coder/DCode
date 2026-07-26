/**
 * Glob → RegExp translation shared by the `glob` and `grep` tools.
 *
 * 支持 `**`、`*`、`?` 以及 `{a,b}` 花括号展开（可嵌套）。
 * 匹配区分大小写，与 ripgrep / git 的 pathspec 语义一致。
 */

function escapeRegexChar(ch: string): string {
  return ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function findClosingBrace(pattern: string, start: number): number {
  let depth = 0;
  for (let i = start; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') {
      current += ch + (body[i + 1] ?? '');
      i++;
    } else if (ch === '{') {
      depth++;
      current += ch;
    } else if (ch === '}') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * 把 glob 翻译成正则片段（不含锚点）。
 *
 * 花括号的每个分支都会递归走同一套翻译，因此 `{*.ts,*.js}` 里的 `*`
 * 会被正确翻译成 `[^/]*`，而不是当作字面量留下一个悬空量词。
 */
function translate(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      // `**/` 允许匹配零层目录
      if (pattern[i] === '/') i++;
    } else if (ch === '*') {
      out += '[^/]*';
      i++;
    } else if (ch === '?') {
      out += '[^/]';
      i++;
    } else if (ch === '{') {
      const end = findClosingBrace(pattern, i);
      if (end === -1) {
        out += escapeRegexChar(ch);
        i++;
      } else {
        const options = splitTopLevel(pattern.slice(i + 1, end));
        out += `(?:${options.map(translate).join('|')})`;
        i = end + 1;
      }
    } else {
      out += escapeRegexChar(ch);
      i++;
    }
  }
  return out;
}

export function globToRegex(pattern: string): RegExp {
  return new RegExp(`^${translate(pattern)}$`);
}

/**
 * 预编译一个 glob 匹配器，供逐文件过滤复用——避免在 per-file 谓词里重复编译正则。
 *
 * 不含 `/` 的模式同时按 basename 匹配，这样 `*.ts` 能命中 `src/a.ts`。
 */
export function createGlobMatcher(pattern: string): (relPath: string) => boolean {
  const regex = globToRegex(pattern);
  const alsoMatchBasename = !pattern.includes('/');
  return (relPath: string): boolean => {
    if (regex.test(relPath)) return true;
    if (!alsoMatchBasename) return false;
    const slash = relPath.lastIndexOf('/');
    return slash !== -1 && regex.test(relPath.slice(slash + 1));
  };
}
