import { ToolExecutor, ToolExecuteResult } from './types';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { resolveInside } from '../pathSandbox';
import { debugLog } from '../logger';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.next',
  'coverage',
  '__pycache__',
]);

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.doc', '.docx',
  '.db', '.sqlite',
]);

const TYPE_EXTENSIONS: Record<string, string[]> = {
  js: ['.js', '.jsx', '.mjs', '.cjs'],
  ts: ['.ts', '.tsx', '.mts', '.cts'],
  jsx: ['.jsx'],
  tsx: ['.tsx'],
  py: ['.py', '.pyw'],
  rust: ['.rs'],
  rs: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  kt: ['.kt', '.kts'],
  kotlin: ['.kt', '.kts'],
  rb: ['.rb'],
  php: ['.php'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  cs: ['.cs'],
  swift: ['.swift'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss'],
  json: ['.json', '.jsonc'],
  yaml: ['.yaml', '.yml'],
  md: ['.md', '.mdx'],
  sh: ['.sh', '.bash', '.zsh'],
  sql: ['.sql'],
};

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      regex += '.*';
      i += 2;
      if (pattern[i] === '/') i++;
    } else if (ch === '*') {
      regex += '[^/]*';
      i++;
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const options = pattern.slice(i + 1, end).split(',');
        regex += `(?:${options.map(escapeRegex).join('|')})`;
        i = end + 1;
      } else {
        regex += escapeRegex(ch);
        i++;
      }
    } else {
      regex += escapeRegex(ch);
      i++;
    }
  }
  return new RegExp(`^${regex}$`, 'i');
}

function matchesGlobPath(filePath: string, basePath: string, pattern: string): boolean {
  const relPath = relative(basePath, filePath).replace(/\\/g, '/');
  const basename = relPath.split('/').pop() ?? relPath;
  const regex = globToRegex(pattern);
  return regex.test(relPath) || (!pattern.includes('/') && regex.test(basename));
}

function matchesType(filePath: string, type: string | undefined): boolean {
  if (!type) return true;
  const normalized = type.toLowerCase().replace(/^\./, '');
  const ext = extname(filePath).toLowerCase();
  const known = TYPE_EXTENSIONS[normalized];
  return known ? known.includes(ext) : ext === `.${normalized}`;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

async function walkDir(dir: string, files: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

async function collectSearchFiles(searchPath: string): Promise<string[]> {
  const info = await stat(searchPath);
  if (info.isFile()) return [searchPath];
  if (!info.isDirectory()) {
    throw new Error(`Path is not a file or directory: ${searchPath}`);
  }
  const files: string[] = [];
  await walkDir(searchPath, files);
  return files;
}

interface CountResult {
  file: string;
  count: number;
}

interface ContentLine {
  line: number;
  content: string;
}

interface ContentMatchGroup {
  file: string;
  lines: ContentLine[];
}

type OutputMode = 'files_with_matches' | 'content' | 'count';

export const grepTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'grep',
    description:
      'Fast regex search over file contents, with ripgrep-style options. Use this instead of bash grep/rg. Defaults to file paths only; use output_mode "content" for matching lines or "count" for counts. Filter with glob or type; use glob for filename-only searches.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for in file contents. Escape literal braces, e.g. interface\\{\\}.',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in. Defaults to the current project directory.',
          default: '.',
        },
        glob: {
          type: 'string',
          description: 'Glob filter for files, e.g. "*.js", "*.{ts,tsx}", or "src/**/*.ts".',
        },
        type: {
          type: 'string',
          description: 'File type filter such as js, ts, py, rust, go, java, md, json, css.',
        },
        output_mode: {
          type: 'string',
          enum: ['files_with_matches', 'content', 'count'],
          default: 'files_with_matches',
          description: 'files_with_matches returns paths, content returns matching lines, count returns per-file counts.',
        },
        context: {
          type: 'number',
          default: 0,
          description: 'Lines before and after each match for output_mode "content" (rg -C).',
        },
        '-C': {
          type: 'number',
          description: 'Alias for context.',
        },
        context_lines: {
          type: 'number',
          default: 0,
          description: 'Alias for context.',
        },
        '-A': {
          type: 'number',
          description: 'Lines to show after each match for output_mode "content".',
        },
        '-B': {
          type: 'number',
          description: 'Lines to show before each match for output_mode "content".',
        },
        '-n': {
          type: 'boolean',
          default: true,
          description: 'Show line numbers in content mode. Defaults to true.',
        },
        '-i': {
          type: 'boolean',
          default: false,
          description: 'Case-insensitive search.',
        },
        head_limit: {
          type: 'number',
          default: 250,
          description: 'Maximum entries to return. Defaults to 250; pass 0 for unlimited.',
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Number of entries to skip before applying head_limit.',
        },
        multiline: {
          type: 'boolean',
          default: false,
          description: 'Allow patterns to span lines; dot matches newlines.',
        },
        case_insensitive: {
          type: 'boolean',
          default: false,
          description: 'Alias for -i.',
        },
        max_results: {
          type: 'number',
          description: 'Deprecated alias for head_limit.',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const pattern = args.pattern as string;
    const rawPath = (args.path as string) || '.';
    const globFilter = args.glob as string | undefined;
    const typeFilter = args.type as string | undefined;
    const outputMode = (args.output_mode as OutputMode) ?? 'files_with_matches';
    const contextLines = numberArg(args.context ?? args['-C'] ?? args.context_lines, 0);
    const afterLines = args['-A'] as number | undefined;
    const beforeLines = args['-B'] as number | undefined;
    const headLimit = numberArg(args.head_limit ?? args.max_results, 250);
    const offset = numberArg(args.offset, 0);
    const multiline = (args.multiline as boolean) ?? false;
    const caseInsensitive = (args['-i'] as boolean) ?? (args.case_insensitive as boolean) ?? false;
    const showLineNumbers = args['-n'] !== false;

    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new Error('grep requires a non-empty pattern');
    }

    const effectiveBefore = numberArg(beforeLines, contextLines);
    const effectiveAfter = numberArg(afterLines, contextLines);

    const effectiveLimit = headLimit === 0 ? Infinity : headLimit;

    debugLog('tool', '搜索:', pattern, 'mode:', outputMode, 'in', rawPath);

    const searchPath = resolveInside(rawPath, ctx.projectPath).absolutePath;

    try {
      const flags = (caseInsensitive ? 'i' : '') + (multiline ? 's' : '');

      if (/\([^)]*[+*][^)]*\)[+*]/.test(pattern) || /\[[^\]]*\][+*]\)[+*]/.test(pattern)) {
        throw new Error('Pattern rejected: potential catastrophic backtracking (nested quantifiers)');
      }
      const regex = new RegExp(pattern, flags);
      const allFiles = await collectSearchFiles(searchPath);

      const files = allFiles.filter((file) => {
        if (globFilter && !matchesGlobPath(file, searchPath, globFilter)) return false;
        if (!matchesType(file, typeFilter)) return false;
        return true;
      });

      if (outputMode === 'files_with_matches') {
        const matchedFiles: string[] = [];
        for (const file of files) {
          const ext = extname(file).toLowerCase();
          if (BINARY_EXTS.has(ext)) continue;
          try {
            const content = await readFile(file, 'utf-8');
            if (multiline) {
              if (regex.test(content)) matchedFiles.push(relative(searchPath, file));
            } else {
              const lines = content.split('\n');
              if (lines.some((l) => regex.test(l))) matchedFiles.push(relative(searchPath, file));
            }
          } catch {          }
        }
        const paged = matchedFiles.slice(offset, offset + effectiveLimit);
        const truncated = matchedFiles.length > offset + effectiveLimit;
        const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + effectiveLimit} 翻页）` : '';
        return {
          content: paged.length > 0
            ? `找到 ${matchedFiles.length} 个匹配文件:\n${paged.join('\n')}${suffix}`
            : `未找到匹配 "${pattern}" 的文件`,
          metadata: { kind: 'grep', pattern, matchCount: matchedFiles.length, fileCount: matchedFiles.length },
        };
      }

      if (outputMode === 'count') {
        const counts: CountResult[] = [];
        for (const file of files) {
          const ext = extname(file).toLowerCase();
          if (BINARY_EXTS.has(ext)) continue;
          try {
            const content = await readFile(file, 'utf-8');
            let count: number;
            if (multiline) {
              const matches = content.match(new RegExp(pattern, flags + 'g'));
              count = matches?.length ?? 0;
            } else {
              const lines = content.split('\n');
              count = lines.filter((l) => regex.test(l)).length;
            }
            if (count > 0) counts.push({ file: relative(searchPath, file), count });
          } catch {          }
        }
        counts.sort((a, b) => b.count - a.count);
        const paged = counts.slice(offset, offset + effectiveLimit);
        const totalMatches = counts.reduce((sum, c) => sum + c.count, 0);
        const truncated = counts.length > offset + effectiveLimit;
        const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + effectiveLimit} 翻页）` : '';
        return {
          content: paged.length > 0
            ? `匹配统计（${counts.length} 个文件，共 ${totalMatches} 处）:\n${paged.map((c) => `${c.file}: ${c.count}`).join('\n')}${suffix}`
            : `未找到匹配 "${pattern}" 的结果`,
          metadata: { kind: 'grep', pattern, matchCount: totalMatches, fileCount: counts.length },
        };
      }

      const matchGroups: ContentMatchGroup[] = [];

      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;
        try {
          const content = await readFile(file, 'utf-8');
          const relPath = relative(searchPath, file);

          if (multiline) {

            let m: RegExpExecArray | null;
            const re = new RegExp(pattern, flags + 'g');
            while ((m = re.exec(content)) !== null) {
              const lineNum = content.slice(0, m.index).split('\n').length;
              const matchLine = m[0];
              matchGroups.push({ file: relPath, lines: [{ line: lineNum, content: matchLine }] });
              if (m[0] === '') re.lastIndex++;
            }
          } else {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const start = Math.max(0, i - effectiveBefore);
                const end = Math.min(lines.length - 1, i + effectiveAfter);
                const groupLines: ContentLine[] = [];
                for (let j = start; j <= end; j++) {
                  groupLines.push({ line: j + 1, content: lines[j].trimEnd() });
                }
                matchGroups.push({ file: relPath, lines: groupLines });
              }
            }
          }
        } catch {          }
      }

      const totalMatchCount = matchGroups.length;
      const fileCount = new Set(matchGroups.map((m) => m.file)).size;

      if (totalMatchCount === 0) {
        return {
          content: `未找到匹配 "${pattern}" 的结果`,
          metadata: { kind: 'grep', pattern, matchCount: 0, fileCount: 0 },
        };
      }

      const pagedGroups = matchGroups.slice(offset, offset + effectiveLimit);
      const resultLines = pagedGroups.flatMap((group) => {
        return group.lines.map((line) => (
          showLineNumbers
            ? `${group.file}:${line.line}: ${line.content}`
            : `${group.file}: ${line.content}`
        ));
      });

      const truncated = totalMatchCount > offset + effectiveLimit;
      const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + effectiveLimit} 翻页）` : '';

      return {
        content: `找到 ${totalMatchCount} 条匹配${truncated ? '（已截断）' : ''}:\n${resultLines.join('\n')}${suffix}`,
        metadata: { kind: 'grep', pattern, matchCount: totalMatchCount, fileCount },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`搜索失败: ${error}`);
    }
  },
};
