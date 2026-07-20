import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { ToolExecuteResult } from '../types';
import type { ToolResultContentBlock } from '../../../shared/types';

const IMAGE_MEDIA_TYPES = new Map<string, 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

const execFileAsync = promisify(execFile);

export function isImageFile(filePath: string, mimeType?: string): boolean {
  if (mimeType && [...IMAGE_MEDIA_TYPES.values()].includes(mimeType as any)) return true;
  return IMAGE_MEDIA_TYPES.has(extname(filePath).toLowerCase());
}

function imageMediaType(filePath: string, mimeType?: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  if (mimeType && [...IMAGE_MEDIA_TYPES.values()].includes(mimeType as any)) {
    return mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  }
  const mediaType = IMAGE_MEDIA_TYPES.get(extname(filePath).toLowerCase());
  if (!mediaType) throw new Error(`Unsupported image type: ${extname(filePath) || 'unknown'}`);
  return mediaType;
}

export function isPdfFile(filePath: string, mimeType?: string): boolean {
  return extname(filePath).toLowerCase() === '.pdf' || mimeType === 'application/pdf';
}

function parsePdfPageRange(pages: string): { firstPage: number; lastPage: number } {
  const trimmed = pages.trim();
  if (!trimmed) throw new Error('Invalid PDF page range');

  const dash = trimmed.indexOf('-');
  if (dash === -1) {
    const page = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(page) || page < 1) throw new Error('Invalid PDF page range');
    return { firstPage: page, lastPage: page };
  }

  const firstPage = Number.parseInt(trimmed.slice(0, dash), 10);
  const lastPage = Number.parseInt(trimmed.slice(dash + 1), 10);
  if (!Number.isInteger(firstPage) || !Number.isInteger(lastPage) || firstPage < 1 || lastPage < firstPage) {
    throw new Error('Invalid PDF page range');
  }
  if (lastPage - firstPage + 1 > 20) {
    throw new Error('PDF page range cannot exceed 20 pages per request');
  }
  return { firstPage, lastPage };
}

export async function readImageBlock(filePath: string, originalSize: number, mimeType?: string): Promise<ToolExecuteResult> {
  const mediaType = imageMediaType(filePath, mimeType);
  const bytes = await readFile(filePath);
  return {
    content: [`[Image file]`, `Path: ${filePath}`, `Size: ${originalSize} bytes`].join('\n'),
    contentBlocks: [{
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: bytes.toString('base64'),
      },
    }],
    metadata: { kind: 'read', path: filePath, lineCount: 0, truncated: false },
  };
}

export async function readPdfBlock(filePath: string, originalSize: number, pages?: string): Promise<ToolExecuteResult> {
  if (pages) return readPdfPagesAsImages(filePath, originalSize, pages);

  const bytes = await readFile(filePath);
  const header = bytes.subarray(0, 5).toString('ascii');
  if (!header.startsWith('%PDF-')) {
    throw new Error(`File is not a valid PDF: ${filePath}`);
  }
  return {
    content: [`[PDF file]`, `Path: ${filePath}`, `Size: ${originalSize} bytes`].join('\n'),
    contentBlocks: [{
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: bytes.toString('base64'),
      },
    }],
    metadata: { kind: 'read', path: filePath, lineCount: 0, truncated: false },
  };
}

async function readPdfPagesAsImages(filePath: string, originalSize: number, pages: string): Promise<ToolExecuteResult> {
  const { firstPage, lastPage } = parsePdfPageRange(pages);
  const outputDir = join(tmpdir(), `dcode-pdf-pages-${randomUUID()}`);
  await mkdir(outputDir, { recursive: true });
  const prefix = join(outputDir, 'page');

  try {
    await execFileAsync('pdftoppm', [
      '-jpeg',
      '-f', String(firstPage),
      '-l', String(lastPage),
      filePath,
      prefix,
    ], { timeout: 30_000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF page rendering failed. Install poppler-utils (pdftoppm) to use pages. ${message}`);
  }

  const files = (await readdir(outputDir)).filter(file => file.endsWith('.jpg')).sort();
  const contentBlocks: ToolResultContentBlock[] = [];
  for (const file of files) {
    const bytes = await readFile(join(outputDir, file));
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: bytes.toString('base64'),
      },
    });
  }
  return {
    content: [`[PDF pages]`, `Path: ${filePath}`, `Pages: ${pages}`, `Rendered pages: ${contentBlocks.length}`].join('\n'),
    contentBlocks,
    metadata: { kind: 'read', path: filePath, lineCount: 0, truncated: false },
  };
}
