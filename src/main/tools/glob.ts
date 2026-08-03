import { ToolExecutor, ToolExecuteResult } from './types';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '../pathSandbox';
import { debugLog } from '../debug';
import { globToRegex } from './globMatch';
import { createIgnoreFilter } from './ignoreFilter';
import { DEFAULT_IO_CONCURRENCY, mapWithConcurrency } from '../utils/concurrency';
import { collectRelativeFilePaths } from './fileTraversal';

interface GlobFile {
  path: string;
  mtimeMs: number;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function boolArg(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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
        no_ignore: {
          type: 'boolean',
          description: 'Set true to search files that .gitignore would normally exclude.',
          default: false,
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
    const respectGitignore = !boolArg(args.no_ignore, false);
    debugLog('tool', 'Finding files:', pattern, 'in', rawPath);

    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new Error('glob requires a non-empty pattern');
    }

    const searchPath = resolveInside(rawPath, ctx.projectPath).absolutePath;

    try {
      const rootInfo = await stat(searchPath);
      if (!rootInfo.isDirectory()) {
        throw new Error(`Path is not a directory: ${searchPath}`);
      }

      // Compile once instead of rebuilding the regex in the per-file predicate.
      const regex = globToRegex(pattern);

      const ignore = createIgnoreFilter(respectGitignore);
      const allPaths = await collectRelativeFilePaths(searchPath, ignore);

      const matchedPaths = allPaths.filter((relPath) => regex.test(relPath));
      const stats = await mapWithConcurrency(
        matchedPaths,
        DEFAULT_IO_CONCURRENCY,
        async (relPath): Promise<GlobFile | null> => {
          try {
            const info = await stat(join(searchPath, relPath));
            return { path: relPath, mtimeMs: info.mtimeMs };
          } catch {
            return null;
          }
        },
      );

      const matched = stats
        .filter((file): file is GlobFile => file !== null)
        .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
      const paged = limit === 0 ? matched.slice(offset) : matched.slice(offset, offset + limit);
      const truncated = limit !== 0 && matched.length > offset + limit;
      const suffix = truncated ? `\n(More results are available; use offset ${offset + limit} to paginate.)` : '';

      if (matched.length === 0) {
        return {
          content: `No files matched "${pattern}"`,
          metadata: { kind: 'glob', pattern, matchCount: 0 },
        };
      }

      return {
          content: `Found ${matched.length} files${truncated ? ' (truncated)' : ''}:\n${paged.map((file) => file.path).join('\n')}${suffix}`,
        metadata: { kind: 'glob', pattern, matchCount: matched.length },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to find files: ${error}`);
    }
  },
};
