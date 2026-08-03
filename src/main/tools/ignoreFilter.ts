/**
 * A `.gitignore`-aware directory/file filter shared by `glob` and `grep` traversal.
 *
 * Semantics align with ripgrep: always-skipped directories plus repository `.gitignore` rules,
 * including root and nested files encountered during traversal. Later matching rules override earlier ones;
 * the `!` prefix negates an ignore rule.
 *
 * Implement the common gitignore subset: comments, blank lines, `!` negation, a trailing `/` directory-only rule,
 * a leading or middle `/` anchored to the directory containing that `.gitignore`, and `*` / `**` / `?` wildcards.
 * Character classes such as `[a-z]` are not supported and are treated literally.
 */

const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.next',
  'coverage',
  '__pycache__',
]);

interface IgnoreRule {
  self: RegExp;
  subtree: RegExp;
  negated: boolean;
  dirOnly: boolean;
}

interface RuleSet {
  base: string;
  rules: IgnoreRule[];
}

function translateGitignorePattern(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      if (pattern[i] === '/') i++;
    } else if (ch === '*') {
      out += '[^/]*';
      i++;
    } else if (ch === '?') {
      out += '[^/]';
      i++;
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  return out;
}

function parseLine(rawLine: string): IgnoreRule | null {
  let line = rawLine;

  line = line.replace(/(?<!\\)\s+$/, '');
  if (line.length === 0) return null;
  if (line.startsWith('#')) return null;

  let negated = false;
  if (line.startsWith('!')) {
    negated = true;
    line = line.slice(1);
  } else if (line.startsWith('\\!') || line.startsWith('\\#')) {
    line = line.slice(1);
  }
  if (line.length === 0) return null;

  let dirOnly = false;
  if (line.endsWith('/')) {
    dirOnly = true;
    line = line.slice(0, -1);
  }
  if (line.length === 0) return null;

  let anchored = false;
  if (line.startsWith('/')) {
    anchored = true;
    line = line.slice(1);
  } else if (line.includes('/')) {
    anchored = true;
  }
  if (line.length === 0) return null;

  const body = translateGitignorePattern(line);
  const prefix = anchored ? '' : '(?:.*/)?';

  try {
    return {
      self: new RegExp(`^${prefix}${body}$`),
      subtree: new RegExp(`^${prefix}${body}/.*$`),
      negated,
      dirOnly,
    };
  } catch {
    return null;
  }
}

function parseRules(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const rule = parseLine(rawLine);
    if (rule) rules.push(rule);
  }
  return rules;
}

export class IgnoreFilter {
  private readonly ruleSets: RuleSet[] = [];

  constructor(private readonly enabled: boolean) {}

  addRules(base: string, content: string): void {
    if (!this.enabled) return;
    const rules = parseRules(content);
    if (rules.length > 0) this.ruleSets.push({ base, rules });
  }

  isDefaultIgnoredDir(name: string): boolean {
    return DEFAULT_IGNORE_DIRS.has(name);
  }

  /**
   * Check whether a POSIX path relative to the search root is ignored.
   * `isDir` affects directory-only rules, which end with `/`.
   */
  ignores(relPath: string, isDir: boolean): boolean {
    if (!this.enabled || this.ruleSets.length === 0) return false;

    let ignored = false;
    for (const set of this.ruleSets) {
      if (set.base && !relPath.startsWith(`${set.base}/`)) continue;
      const scoped = set.base ? relPath.slice(set.base.length + 1) : relPath;
      if (!scoped) continue;
      for (const rule of set.rules) {
        const hitsSelf = (!rule.dirOnly || isDir) && rule.self.test(scoped);
        if (hitsSelf || rule.subtree.test(scoped)) ignored = !rule.negated;
      }
    }
    return ignored;
  }
}

export function createIgnoreFilter(enabled: boolean): IgnoreFilter {
  return new IgnoreFilter(enabled);
}
