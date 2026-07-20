import type { Attachment } from '../../../shared/types';

export const ALLOWED_ELEMENTS = /<(style|p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody|h[1-6]|blockquote|pre|code|br|hr|svg|path|circle|rect|line|polyline|polygon|text|g|defs|title|desc|tspan|sub|sup|details|summary|mark|abbr|kbd|dl|dt|dd|section|article|header|footer|nav|figure|figcaption)/i;
export const DISALLOWED_ELEMENTS = ['iframe', 'script'];
export const USER_SLASH_COMMAND_CLASS = 'inline-flex items-center gap-1.5 align-baseline font-medium text-accent';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/<[^>]*>/g, '')
    .replace(/```[a-z]*\n([\s\S]*?)\n```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}(?:[-+*]|\d+\.)\s+/gm, '')
    .replace(/^\s{0,3}>\s+/gm, '');
}

export function kindIcon(kind: Attachment['kind']): string {
  switch (kind) {
    case 'image': return '🖼';
    case 'audio': return '🎵';
    case 'video': return '🎬';
    default:      return '📄';
  }
}

export const cleanErrorText = (content: string) => {
  return content
    .replace(/^❌\s*(?:错误)?\s*:?\s*/i, '')
    .replace(/^Error:\s*/i, '');
};
