import type { ToolItem } from '../../../shared/types';

export const OUTPUT_PREVIEW_CHARS = 4000;
export const OUTPUT_PREVIEW_LINES = 200;

export function getOutput(item: ToolItem): string | undefined {
  if ('output' in item) return item.output;
  return undefined;
}

export function getDiff(item: ToolItem): string | undefined {
  if (item.kind === 'write' || item.kind === 'edit') return item.diff;
  return undefined;
}

export function getFileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function trimMatchingQuotes(value: string): string {
  let text = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      text = text.slice(1, -1).trim();
      changed = true;
    }
  }
  return text
    .replace(/'"'"'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

export function normalizeShellCommand(command: string): string {
  const strippedPrompt = command.trim().replace(/^\$\s+/, '');
  const unquoted = trimMatchingQuotes(strippedPrompt);
  const loginShellMatch = unquoted.match(/^(?:\/bin\/zsh|\/bin\/bash|zsh|bash)\s+-lc\s+([\s\S]+)$/);
  if (!loginShellMatch) return unquoted;
  return trimMatchingQuotes(loginShellMatch[1] ?? '');
}
