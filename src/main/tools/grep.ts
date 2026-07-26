import { ToolExecutor, ToolExecuteResult } from './types';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { resolveInside } from '../pathSandbox';
import { debugLog } from '../debug';
import { createGlobMatcher } from './globMatch';
import { createIgnoreFilter, type IgnoreFilter } from './ignoreFilter';
import { DEFAULT_IO_CONCURRENCY } from '../utils/concurrency';
import { collectRelativeFilePaths } from './fileTraversal';

/** 超过此大小的文件跳过不搜——避免把打包产物、日志整个读进内存再逐行切分。 */
const MAX_SEARCHABLE_BYTES = 20 * 1024 * 1024;

/** 每批并行处理的文件数。批与批之间按顺序推进，保证输出稳定且可提前终止。 */
const SCAN_BATCH_SIZE = DEFAULT_IO_CONCURRENCY * 4;

/** 二进制嗅探窗口：前 8KB 里出现 NUL 字节即判定为二进制。 */
const BINARY_SNIFF_BYTES = 8192;

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

function relativeDisplayPath(basePath: string, filePath: string): string {
  return relative(basePath, filePath).replace(/\\/g, '/');
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

function boolArg(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function collectSearchFiles(searchPath: string, ignore: IgnoreFilter): Promise<string[]> {
  const info = await stat(searchPath);
  if (info.isFile()) return [searchPath];
  if (!info.isDirectory()) {
    throw new Error(`Path is not a file or directory: ${searchPath}`);
  }
  const relativePaths = await collectRelativeFilePaths(searchPath, ignore);
  return relativePaths.map((relativePath) => join(searchPath, relativePath));
}

interface LoadedFile {
  /** 文件文本；跳过（二进制/过大/读失败）时为 null。 */
  text: string | null;
  /** 因体积超限被跳过 */
  tooLarge: boolean;
}

/** 读取候选文件，顺带做体积与二进制判定。任何失败都降级为「跳过」。 */
async function loadSearchableFile(filePath: string): Promise<LoadedFile> {
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return { text: null, tooLarge: false };

  try {
    const info = await stat(filePath);
    if (info.size > MAX_SEARCHABLE_BYTES) return { text: null, tooLarge: true };

    const buffer = await readFile(filePath);
    // 扩展名之外再做一次内容嗅探，捕获无扩展名/非常见后缀的二进制文件
    const sniffEnd = Math.min(buffer.length, BINARY_SNIFF_BYTES);
    if (buffer.indexOf(0, 0) !== -1 && buffer.indexOf(0, 0) < sniffEnd) {
      return { text: null, tooLarge: false };
    }
    return { text: buffer.toString('utf-8'), tooLarge: false };
  } catch {
    return { text: null, tooLarge: false };
  }
}

/**
 * 按批并行扫描文件：批内并发，批间顺序推进。
 *
 * `shouldStop` 在每批结束后被调用，返回 true 就不再读取后续文件——
 * 这样 head_limit 能真正省下 I/O，而不是扫完全仓库再 slice。
 * 结果按文件顺序回调，因此输出与并发无关，保持确定性。
 */
async function scanFiles(
  files: readonly string[],
  onFile: (filePath: string, text: string) => void,
  shouldStop: () => boolean,
): Promise<{ skippedTooLarge: number }> {
  let skippedTooLarge = 0;

  for (let start = 0; start < files.length; start += SCAN_BATCH_SIZE) {
    const batch = files.slice(start, start + SCAN_BATCH_SIZE);
    const loaded = await Promise.all(batch.map((file) => loadSearchableFile(file)));

    for (let i = 0; i < batch.length; i++) {
      if (loaded[i].tooLarge) skippedTooLarge++;
      const text = loaded[i].text;
      if (text !== null) onFile(batch[i], text);
    }

    if (shouldStop()) break;
  }

  return { skippedTooLarge };
}

/** 预计算换行位置，把「偏移量 → 行号」从 O(n) 降到 O(log n)。 */
function buildLineIndex(content: string): number[] {
  const starts = [0];
  for (let i = content.indexOf('\n'); i !== -1; i = content.indexOf('\n', i + 1)) {
    starts.push(i + 1);
  }
  return starts;
}

function lineNumberAt(lineStarts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
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
        no_ignore: {
          type: 'boolean',
          default: false,
          description: 'Set true to search files that .gitignore would normally exclude.',
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
    const respectGitignore = !boolArg(args.no_ignore, false);

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

      const ignore = createIgnoreFilter(respectGitignore);
      const allFiles = await collectSearchFiles(searchPath, ignore);

      // glob 只编译一次，而不是在 per-file 谓词里反复构造
      const globMatches = globFilter ? createGlobMatcher(globFilter) : null;
      const files = allFiles.filter((file) => {
        if (globMatches && !globMatches(relativeDisplayPath(searchPath, file))) return false;
        if (!matchesType(file, typeFilter)) return false;
        return true;
      });

      /** 已够返回一页时提前收工，省下后续文件的 I/O。 */
      const enough = (collected: number): boolean =>
        effectiveLimit !== Infinity && collected > offset + effectiveLimit;

      const noteSkipped = (skipped: number): string =>
        skipped > 0 ? `\n（另有 ${skipped} 个文件超过 ${MAX_SEARCHABLE_BYTES / 1024 / 1024}MB 未搜索）` : '';

      if (outputMode === 'files_with_matches') {
        const matchedFiles: string[] = [];
        const { skippedTooLarge } = await scanFiles(
          files,
          (file, content) => {
            const hit = multiline
              ? regex.test(content)
              : content.split('\n').some((l) => regex.test(l));
            if (hit) matchedFiles.push(relativeDisplayPath(searchPath, file));
          },
          () => enough(matchedFiles.length),
        );

        const paged = matchedFiles.slice(offset, offset + effectiveLimit);
        const truncated = matchedFiles.length > offset + effectiveLimit;
        const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + effectiveLimit} 翻页）` : '';
        return {
          content: paged.length > 0
            ? `找到 ${matchedFiles.length} 个匹配文件:\n${paged.join('\n')}${suffix}${noteSkipped(skippedTooLarge)}`
            : `未找到匹配 "${pattern}" 的文件${noteSkipped(skippedTooLarge)}`,
          metadata: { kind: 'grep', pattern, matchCount: matchedFiles.length, fileCount: matchedFiles.length },
        };
      }

      if (outputMode === 'count') {
        const counts: CountResult[] = [];
        // count 模式要按次数排序，必须扫完全部文件才能确定名次
        const { skippedTooLarge } = await scanFiles(
          files,
          (file, content) => {
            let count: number;
            if (multiline) {
              const matches = content.match(new RegExp(pattern, flags + 'g'));
              count = matches?.length ?? 0;
            } else {
              count = content.split('\n').filter((l) => regex.test(l)).length;
            }
            if (count > 0) counts.push({ file: relativeDisplayPath(searchPath, file), count });
          },
          () => false,
        );
        counts.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
        const paged = counts.slice(offset, offset + effectiveLimit);
        const totalMatches = counts.reduce((sum, c) => sum + c.count, 0);
        const truncated = counts.length > offset + effectiveLimit;
        const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + effectiveLimit} 翻页）` : '';
        return {
          content: paged.length > 0
            ? `匹配统计（${counts.length} 个文件，共 ${totalMatches} 处）:\n${paged.map((c) => `${c.file}: ${c.count}`).join('\n')}${suffix}${noteSkipped(skippedTooLarge)}`
            : `未找到匹配 "${pattern}" 的结果${noteSkipped(skippedTooLarge)}`,
          metadata: { kind: 'grep', pattern, matchCount: totalMatches, fileCount: counts.length },
        };
      }

      const matchGroups: ContentMatchGroup[] = [];

      const { skippedTooLarge } = await scanFiles(
        files,
        (file, content) => {
          const relPath = relativeDisplayPath(searchPath, file);

          if (multiline) {
            // 预建换行索引，行号查询变成二分；此前每个匹配都要 slice + split，
            // 匹配数多的文件会退化成 O(n·m)
            const lineStarts = buildLineIndex(content);
            const re = new RegExp(pattern, flags + 'g');
            let m: RegExpExecArray | null;
            while ((m = re.exec(content)) !== null) {
              matchGroups.push({
                file: relPath,
                lines: [{ line: lineNumberAt(lineStarts, m.index), content: m[0] }],
              });
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
        },
        () => enough(matchGroups.length),
      );

      const totalMatchCount = matchGroups.length;
      const fileCount = new Set(matchGroups.map((m) => m.file)).size;

      if (totalMatchCount === 0) {
        return {
          content: `未找到匹配 "${pattern}" 的结果${noteSkipped(skippedTooLarge)}`,
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
        content: `找到 ${totalMatchCount} 条匹配${truncated ? '（已截断）' : ''}:\n${resultLines.join('\n')}${suffix}${noteSkipped(skippedTooLarge)}`,
        metadata: { kind: 'grep', pattern, matchCount: totalMatchCount, fileCount },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`搜索失败: ${error}`);
    }
  },
};
