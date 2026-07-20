import { ToolExecutor, ToolExecuteResult } from './types';
import { createReadStream, type Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, basename, resolve, join, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { resolveInside } from '../pathSandbox';
import { isParsableDocument, parseDocument } from '../docParser';
import { isImageFile, isPdfFile, readImageBlock, readPdfBlock } from './read-file/media';
import { renderNotebook } from './read-file/notebook';
import { debugLog } from '../logger';

const FAST_TEXT_READ_MAX_BYTES = 10 * 1024 * 1024;
const READ_FILE_STATE_MAX = 200;
const FILE_UNCHANGED_STUB = '[File unchanged: this exact range was already read and the file has not changed.]';
const THIN_SPACE = String.fromCharCode(8239);

export interface ReadFileStateEntry {
  mtimeMs: number;
  size: number;
  offset: number;
  limit?: number;
  lineCount: number;
  truncated: boolean;
}

const readFileState = new Map<string, ReadFileStateEntry>();

const BLOCKED_DEVICE_PATHS = new Set([
  '/dev/zero',
  '/dev/random',
  '/dev/urandom',
  '/dev/full',
  '/dev/stdin',
  '/dev/tty',
  '/dev/console',
  '/dev/stdout',
  '/dev/stderr',
  '/dev/fd/0',
  '/dev/fd/1',
  '/dev/fd/2',
]);

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.floor(value);
}

function resolveRawPath(args: Record<string, unknown>): string {
  const rawPath = stringArg(args, 'file_path');
  if (!rawPath) throw new Error('read_file requires file_path');
  if (rawPath.startsWith('~') && (rawPath.length === 1 || rawPath[1] === '/')) {
    return join(homedir(), rawPath.slice(1));
  }
  return rawPath;
}

function formatNumberedLines(lines: string[], startOffset: number): string {
  return lines
    .map((line, index) => `${String(startOffset + index + 1).padStart(6, ' ')}\t${line}`)
    .join('\n');
}

function rangeArgs(args: Record<string, unknown>): { offset: number; limit?: number } {
  const offset = Math.max(0, numberArg(args, 'offset') ?? 0);
  const limitArg = numberArg(args, 'limit');
  return {
    offset,
    limit: limitArg === undefined ? undefined : Math.max(1, limitArg),
  };
}

function paginateAndNumber(raw: string, args: Record<string, unknown>): { text: string; lineCount: number; truncated: boolean } {
  const { offset, limit } = rangeArgs(args);
  const lines = raw.split('\n');
  const start = Math.min(offset, lines.length);
  const end = limit === undefined ? lines.length : Math.min(start + limit, lines.length);
  const selected = lines.slice(start, end);
  return {
    text: formatNumberedLines(selected, start),
    lineCount: lines.length,
    truncated: start > 0 || end < lines.length,
  };
}

function isBlockedDevicePath(filePath: string): boolean {
  if (BLOCKED_DEVICE_PATHS.has(filePath)) return true;
  return filePath.startsWith('/proc/')
    && (filePath.endsWith('/fd/0') || filePath.endsWith('/fd/1') || filePath.endsWith('/fd/2'));
}

function getAlternateScreenshotPath(filePath: string): string | undefined {
  const filename = basename(filePath);
  const match = filename.match(/^(.+)([ \u202F])(AM|PM)(\.png)$/);
  if (!match) return undefined;
  const alternateSpace = match[2] === ' ' ? THIN_SPACE : ' ';
  return filePath.replace(`${match[2]}${match[3]}${match[4]}`, `${alternateSpace}${match[3]}${match[4]}`);
}

function isENOENT(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function findSimilarFile(filePath: string): Promise<string | undefined> {
  try {
    const dir = dirname(filePath);
    const target = basename(filePath);
    const targetBase = basename(filePath, extname(filePath));
    const files = await readdir(dir);
    const sameBase = files.find((file) => basename(file, extname(file)) === targetBase && file !== target);
    if (sameBase) return join(dir, sameBase);
    const lowerTarget = target.toLowerCase();
    const caseMatch = files.find((file) => file.toLowerCase() === lowerTarget && file !== target);
    if (caseMatch) return join(dir, caseMatch);
    const looseMatch = files.find((file) => {
      const lower = file.toLowerCase();
      return lower.includes(lowerTarget) || lowerTarget.includes(lower);
    });
    return looseMatch ? join(dir, looseMatch) : undefined;
  } catch {
    return undefined;
  }
}

async function suggestPathUnderProject(filePath: string, projectPath: string | null): Promise<string | undefined> {
  if (!projectPath) return undefined;
  const projectParent = dirname(projectPath);
  const parentPrefix = projectParent === sep ? sep : projectParent + sep;
  if (!filePath.startsWith(parentPrefix) || filePath === projectPath || filePath.startsWith(projectPath + sep)) {
    return undefined;
  }
  const candidate = join(projectPath, relative(projectParent, filePath));
  try {
    await stat(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

async function fileNotFoundHint(filePath: string, projectPath: string | null): Promise<string> {
  const [similar, underProject] = await Promise.all([
    findSimilarFile(filePath),
    suggestPathUnderProject(filePath, projectPath),
  ]);
  const hints = [
    similar ? `Similar file: ${similar}` : undefined,
    underProject ? `Did you mean: ${underProject}` : undefined,
  ].filter(Boolean);
  return hints.length > 0 ? `\n${hints.join('\n')}` : '';
}

async function statReadablePath(filePath: string, projectPath: string | null): Promise<{ filePath: string; info: Stats }> {
  try {
    return { filePath, info: await stat(filePath) };
  } catch (err) {
    if (!isENOENT(err)) throw err;

    const alternate = getAlternateScreenshotPath(filePath);
    if (alternate) {
      try {
        return { filePath: alternate, info: await stat(alternate) };
      } catch (alternateErr) {
        if (!isENOENT(alternateErr)) throw alternateErr;
      }
    }

    const hint = await fileNotFoundHint(filePath, projectPath);
    throw new Error(`File not found: ${filePath}${hint}`);
  }
}

function stateKey(filePath: string, args: Record<string, unknown>): string {
  const { offset, limit } = rangeArgs(args);
  return `${filePath}\0${offset}\0${limit ?? 'all'}`;
}

function fullReadStateKey(filePath: string): string {
  return stateKey(filePath, { offset: 0 });
}

export function getFullReadFileState(filePath: string): ReadFileStateEntry | undefined {
  return readFileState.get(fullReadStateKey(filePath));
}

export function rememberFileMutation(filePath: string, info: { mtimeMs: number; size: number }): void {
  const existing = getFullReadFileState(filePath);
  readFileState.set(fullReadStateKey(filePath), {
    mtimeMs: info.mtimeMs,
    size: info.size,
    offset: 0,
    lineCount: existing?.lineCount ?? 0,
    truncated: false,
  });
}

function getUnchangedStub(filePath: string, args: Record<string, unknown>, info: { mtimeMs: number; size: number }): ToolExecuteResult | undefined {
  const key = stateKey(filePath, args);
  const cached = readFileState.get(key);
  if (!cached || cached.mtimeMs !== info.mtimeMs || cached.size !== info.size) return undefined;
  readFileState.delete(key);
  readFileState.set(key, cached);
  return {
    content: [FILE_UNCHANGED_STUB, `Path: ${filePath}`].join('\n'),
    metadata: { kind: 'read', path: filePath, lineCount: cached.lineCount, truncated: cached.truncated },
  };
}

function rememberRead(filePath: string, args: Record<string, unknown>, info: { mtimeMs: number; size: number }, lineCount: number, truncated: boolean): void {
  const { offset, limit } = rangeArgs(args);
  const key = stateKey(filePath, args);
  if (readFileState.has(key)) readFileState.delete(key);
  readFileState.set(key, { mtimeMs: info.mtimeMs, size: info.size, offset, limit, lineCount, truncated });
  while (readFileState.size > READ_FILE_STATE_MAX) {
    const oldest = readFileState.keys().next().value;
    if (oldest === undefined) break;
    readFileState.delete(oldest);
  }
}

async function readTextRange(filePath: string, args: Record<string, unknown>, size: number): Promise<{ text: string; lineCount: number; truncated: boolean }> {
  const { offset, limit } = rangeArgs(args);
  if (size < FAST_TEXT_READ_MAX_BYTES) {
    const raw = await readFile(filePath, 'utf-8');
    return paginateAndNumber(raw, args);
  }

  const lines: string[] = [];
  let currentLine = 0;
  let partial = '';
  let firstChunk = true;
  const endLine = limit === undefined ? Infinity : offset + limit;

  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 512 * 1024 });
    stream.on('data', (chunk: string) => {
      if (firstChunk) {
        firstChunk = false;
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      }
      const data = partial + chunk;
      partial = '';
      let start = 0;
      let newline = data.indexOf('\n', start);
      while (newline !== -1) {
        if (currentLine >= offset && currentLine < endLine) {
          let line = data.slice(start, newline);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          lines.push(line);
        }
        currentLine++;
        start = newline + 1;
        newline = data.indexOf('\n', start);
      }
      if (start < data.length) {
        if (currentLine >= offset && currentLine < endLine) partial = data.slice(start);
      } else {
        partial = '';
      }
    });
    stream.once('error', reject);
    stream.once('end', () => {
      let line = partial;
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (currentLine >= offset && currentLine < endLine) lines.push(line);
      currentLine++;
      resolvePromise();
    });
  });

  return {
    text: formatNumberedLines(lines, offset),
    lineCount: currentLine,
    truncated: offset > 0 || offset + lines.length < currentLine,
  };
}

export const readFileTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'read_file',
    description: "Reads any file from the local filesystem. Text returns with line numbers (cat -n format), images as visual content, PDFs as page images, Jupyter notebooks as cells with outputs. Use offset/limit to paginate large files. Cannot read directories — use Bash for that.",
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file.',
        },
        offset: {
          type: "number",
          description: "Line to start reading from. Only provide if the file is too large to read at once.",
          minimum: 0
        },
        limit: {
          type: "number",
          description: "Number of lines to read. Only provide if the file is too large to read at once.",
          minimum: 1
        },
        pages: {
          type: "string",
          description: "Page range for PDF files (e.g. '1-5'). Only applicable to PDFs. Max 20 pages per request."
        }
      },
      required: ['file_path'],
      additionalProperties: false
    },
    strict: true
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const rawPath = resolveRawPath(args);
    debugLog('tool', '读取文件:', rawPath);

    const resolved = resolve(rawPath);
    const whitelistEntry = ctx.attachmentWhitelist?.get(resolved);
    let filePath: string;
    if (whitelistEntry) {
      filePath = resolved;
      debugLog('tool', '命中附件白名单');
    } else {

      filePath = resolveInside(rawPath, ctx.projectPath).absolutePath;
    }

    if (isBlockedDevicePath(rawPath) || isBlockedDevicePath(filePath)) {
      throw new Error(`Refusing to read blocked device path: ${filePath}`);
    }

    const resolvedReadable = await statReadablePath(filePath, ctx.projectPath);
    filePath = resolvedReadable.filePath;
    const info = resolvedReadable.info;
    if (info.isDirectory()) {
      throw new Error(`Cannot read directories: ${filePath}`);
    }

    if (isImageFile(filePath, whitelistEntry?.mimeType)) {
      return readImageBlock(filePath, info.size, whitelistEntry?.mimeType);
    }

    if (isPdfFile(filePath, whitelistEntry?.mimeType)) {
      return readPdfBlock(filePath, info.size, stringArg(args, 'pages'));
    }

    if (isParsableDocument(filePath, whitelistEntry?.mimeType)) {
      const unchanged = getUnchangedStub(filePath, args, info);
      if (unchanged) return unchanged;
      try {
        const parsed = await parseDocument(filePath, whitelistEntry?.mimeType);
        const { text, lineCount, truncated } = paginateAndNumber(parsed.text, args);
        debugLog('tool', `通过 ${parsed.parser} 解析，原始文本 ${parsed.text.length} 字符${truncated ? '（已截断）' : ''}`);
        rememberRead(filePath, args, info, lineCount, truncated);
        return {
          content: text,
          metadata: { kind: 'read', path: filePath, lineCount, truncated },
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        throw new Error(`文档解析失败 (${filePath}): ${error}`);
      }
    }

    const unchanged = getUnchangedStub(filePath, args, info);
    if (unchanged) return unchanged;
    try {
      const notebook = extname(filePath).toLowerCase() === '.ipynb'
        ? renderNotebook(await readFile(filePath, 'utf-8'))
        : undefined;
      const { text, lineCount, truncated } = notebook
        ? paginateAndNumber(notebook.text, args)
        : await readTextRange(filePath, args, info.size);
      rememberRead(filePath, args, info, lineCount, truncated);
      return {
        content: text,
        contentBlocks: notebook?.contentBlocks.length ? notebook.contentBlocks : undefined,
        metadata: { kind: 'read', path: filePath, lineCount, truncated },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`读取文件失败: ${error}`);
    }
  },
};
