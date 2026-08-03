import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

/** Unified parse-result shape. */
interface ParsedDoc {
  /** Extracted plain text. */
  text: string;
  /** Parser label (pdf, docx, or xlsx), used by logs and UI. */
  parser: 'pdf' | 'docx' | 'xlsx';
  /** Additional metadata, such as page and sheet counts. */
  meta?: Record<string, unknown>;
}

/** Determine whether an ext/mime pair is a binary document worth sending to a parser. */
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
 * Main entry point: parse a file into plain text by type.
 * Throw when the type is unsupported; callers should check isParsableDocument first.
 */
export async function parseDocument(
  filePath: string,
  mimeType?: string,
): Promise<ParsedDoc> {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return parsePdf(filePath);
  if (ext === '.docx' || mimeType?.includes('wordprocessingml')) return parseDocx(filePath);
  if (ext === '.xlsx' || ext === '.xls' || mimeType?.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return parseXlsx(filePath);
  throw new Error(`Unsupported document type: ${ext || mimeType || 'unknown'}`);
}
