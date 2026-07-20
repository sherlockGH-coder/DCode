import { ToolExecutor, ToolExecuteResult } from './types';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
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

/**
 * 将 glob 模式转为正则表达式
 * 支持: **, *, ?, {a,b}
 */
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
  return new RegExp(`^${regex}$`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

interface GlobFile {
  path: string;
  mtimeMs: number;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

async function walkDir(dir: string, basePath: string, files: GlobFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, basePath, files);
    } else if (entry.isFile()) {
      try {
        const info = await stat(fullPath);
        files.push({ path: relative(basePath, fullPath), mtimeMs: info.mtimeMs });
      } catch {

      }
    }
  }
}

export const globTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'glob',
    description:
      'Fast file-name search using glob patterns such as "**/*.js" or "src/**/*.ts". Returns matching paths sorted by recent modification time. Use when you know the filename pattern; use grep for file contents.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files, for example "**/*.ts", "src/**/*.tsx", or "**/*.{js,ts}".',
        },
        path: {
          type: 'string',
          description: 'Directory to search in. Omit to use the current project directory.',
          default: '.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return. Defaults to 100; pass 0 for unlimited.',
          default: 100,
        },
        offset: {
          type: 'number',
          description: 'Number of matching results to skip before returning results.',
          default: 0,
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const pattern = args.pattern as string;
    const rawPath = (args.path as string) || '.';
    const limit = numberArg(args.limit, 100);
    const offset = numberArg(args.offset, 0);
    debugLog('tool', '查找文件:', pattern, 'in', rawPath);

    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new Error('glob requires a non-empty pattern');
    }

    const searchPath = resolveInside(rawPath, ctx.projectPath).absolutePath;

    try {
      const rootInfo = await stat(searchPath);
      if (!rootInfo.isDirectory()) {
        throw new Error(`Path is not a directory: ${searchPath}`);
      }

      const allFiles: GlobFile[] = [];
      await walkDir(searchPath, searchPath, allFiles);

      const regex = globToRegex(pattern);
      const matched = allFiles
        .filter((file) => regex.test(file.path))
        .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
      const paged = limit === 0 ? matched.slice(offset) : matched.slice(offset, offset + limit);
      const truncated = limit !== 0 && matched.length > offset + limit;
      const suffix = truncated ? `\n（还有更多结果，使用 offset: ${offset + limit} 翻页）` : '';

      if (matched.length === 0) {
        return {
          content: `未找到匹配 "${pattern}" 的文件`,
          metadata: { kind: 'glob', pattern, matchCount: 0 },
        };
      }

      return {
        content: `找到 ${matched.length} 个文件${truncated ? '（已截断）' : ''}:\n${paged.map((file) => file.path).join('\n')}${suffix}`,
        metadata: { kind: 'glob', pattern, matchCount: matched.length },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`查找文件失败: ${error}`);
    }
  },
};
