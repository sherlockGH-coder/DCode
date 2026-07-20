import type { ToolResultContentBlock } from '../../../shared/types';

export function renderNotebook(raw: string): { text: string; contentBlocks: ToolResultContentBlock[] } {
  const notebook = JSON.parse(raw) as { cells?: Array<Record<string, unknown>> };
  if (!Array.isArray(notebook.cells)) throw new Error('notebook cells must be an array');
  const contentBlocks: ToolResultContentBlock[] = [];

  const text = notebook.cells.map((cell, index) => {
    const type = typeof cell.cell_type === 'string' ? cell.cell_type : 'unknown';
    const source = sourceText(cell.source);
    const outputs = Array.isArray(cell.outputs)
      ? cell.outputs.map(output => outputText(output, contentBlocks)).filter(Boolean).join('\n')
      : '';
    return [
      `# Cell ${index + 1} [${type}]`,
      source,
      outputs ? '# Outputs\n' + outputs : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { text, contentBlocks };
}

function sourceText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('');
  if (typeof value === 'string') return value;
  return '';
}

function outputText(output: unknown, contentBlocks: ToolResultContentBlock[]): string {
  if (!output || typeof output !== 'object') return '';
  const record = output as Record<string, unknown>;
  const text = sourceText(record.text);
  if (text) return text;
  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    const png = sourceText(dataRecord['image/png']).replace(/\s/g, '');
    if (png) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: png },
      });
    }
    const jpeg = sourceText(dataRecord['image/jpeg']).replace(/\s/g, '');
    if (jpeg) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: jpeg },
      });
    }
    const plain = dataRecord['text/plain'];
    const plainText = sourceText(plain);
    if (plainText) return plainText;
  }
  const ename = typeof record.ename === 'string' ? record.ename : '';
  const evalue = typeof record.evalue === 'string' ? record.evalue : '';
  return [ename, evalue].filter(Boolean).join(': ');
}
