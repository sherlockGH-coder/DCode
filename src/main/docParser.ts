import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

/** 解析结果统一形态 */
export interface ParsedDoc {
  /** 提取到的纯文本 */
  text: string;
  /** 解析器标记（pdf / docx / xlsx），用于日志/UI */
  parser: 'pdf' | 'docx' | 'xlsx';
  /** 额外元信息（页数、表数等） */
  meta?: Record<string, unknown>;
}

/** 按 ext + mime 判断是否为二进制文档（值得调解析器） */
export function isParsableDocument(filePath: string, mimeType?: string): boolean {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.pdf' || ext === '.docx' || ext === '.xlsx' || ext === '.xls') return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType?.includes('officedocument')) return true;
  if (mimeType === 'application/msword' || mimeType === 'application/vnd.ms-excel') return true;
  return false;
}

async function parsePdf(filePath: string): Promise<ParsedDoc> {
  const { PDFParse } = await import('pdf-parse');
  const buf = await readFile(filePath);

  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return {
    text: result.text,
    parser: 'pdf',
    meta: { pageCount: result.pages.length },
  };
}

async function parseDocx(filePath: string): Promise<ParsedDoc> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return {
    text: result.value,
    parser: 'docx',
    meta: { warnings: result.messages.length },
  };
}

async function parseXlsx(filePath: string): Promise<ParsedDoc> {
  const XLSX = await import('xlsx');
  const wb = XLSX.readFile(filePath);
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws);
    parts.push(`# Sheet: ${name}\n${csv}`);
  }
  return {
    text: parts.join('\n\n'),
    parser: 'xlsx',
    meta: { sheetCount: wb.SheetNames.length, sheets: wb.SheetNames },
  };
}

/**
 * 主入口：按文件类型解析为纯文本。
 * 若类型不支持，抛错（调用方应先用 isParsableDocument 判断）。
 */
export async function parseDocument(
  filePath: string,
  mimeType?: string,
): Promise<ParsedDoc> {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return parsePdf(filePath);
  if (ext === '.docx' || mimeType?.includes('wordprocessingml')) return parseDocx(filePath);
  if (ext === '.xlsx' || ext === '.xls' || mimeType?.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return parseXlsx(filePath);
  throw new Error(`不支持的文档类型：${ext || mimeType || 'unknown'}`);
}
