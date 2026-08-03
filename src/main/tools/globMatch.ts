/**
 * Glob → RegExp translation shared by the `glob` and `grep` tools.
 *
 * Supports `**`, `*`, `?`, and brace expansion such as `{a,b}`, including nesting.
 * Matching is case-sensitive and follows ripgrep and git pathspec semantics.
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
 * Translate a glob into a regex fragment without anchors.
 *
 * Each brace branch uses the same recursive translation, so the `*` in `{*.ts,*.js}`
 * correctly becomes `[^/]*` instead of remaining as a literal dangling quantifier.
 */
function translate(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      // `**/` can match zero directory levels.
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
 * Precompile a glob matcher for reuse during per-file filtering instead of rebuilding the regex in the predicate.
 *
 * Patterns without `/` also match basenames, so `*.ts` matches `src/a.ts`.
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
