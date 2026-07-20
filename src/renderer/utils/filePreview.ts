import type { Attachment } from '../../shared/types';
import type { PreviewItem } from '../types/preview';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  go: 'go',
  rs: 'rust',
  json: 'json',
  css: 'css',
  sh: 'bash',
};

export function getFileExtension(pathOrName: string): string {
  return pathOrName.split('.').pop()?.toLowerCase() || '';
}

export function getPreviewKindFromExtension(ext: string): PreviewItem['type'] {
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (HTML_EXTENSIONS.has(ext)) return 'html';
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  return 'code';
}

export function getCodeLanguageFromExtension(ext: string): string {
  return LANGUAGE_BY_EXTENSION[ext] || 'text';
}

export async function buildPreviewFromPath(
  filePath: string,
  initialLine?: number,
): Promise<PreviewItem | null> {
  const ext = getFileExtension(filePath);
  const type = getPreviewKindFromExtension(ext);

  if (type === 'image') {
    return {
      type,
      title: filePath.split('/').pop() || filePath,
      content: `local-file://${filePath}`,
      filePath,
      initialLine,
    };
  }

  const result = await window.dcodeApi.readFileContent(filePath);
  if (!result) return null;

  return {
    type,
    title: result.name,
    content: result.content,
    language: type === 'code' ? getCodeLanguageFromExtension(ext) : undefined,
    filePath: result.path,
    initialLine,
  };
}

export async function buildPreviewFromAttachment(attachment: Attachment): Promise<PreviewItem | null> {
  if (attachment.kind === 'image') {
    return {
      type: 'image',
      title: attachment.name,
      content: `local-file://${attachment.path}`,
      filePath: attachment.path,
    };
  }

  return buildPreviewFromPath(attachment.path);
}
