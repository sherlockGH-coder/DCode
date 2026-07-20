import { stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Attachment, AttachmentKind } from '../shared/types';

const MIME_MAP: Record<string, { mime: string; kind: AttachmentKind }> = {

  '.txt':  { mime: 'text/plain', kind: 'file' },
  '.md':   { mime: 'text/markdown', kind: 'file' },
  '.markdown': { mime: 'text/markdown', kind: 'file' },
  '.json': { mime: 'application/json', kind: 'file' },
  '.yaml': { mime: 'application/yaml', kind: 'file' },
  '.yml':  { mime: 'application/yaml', kind: 'file' },
  '.toml': { mime: 'application/toml', kind: 'file' },
  '.xml':  { mime: 'application/xml', kind: 'file' },
  '.csv':  { mime: 'text/csv', kind: 'file' },
  '.html': { mime: 'text/html', kind: 'file' },
  '.htm':  { mime: 'text/html', kind: 'file' },
  '.css':  { mime: 'text/css', kind: 'file' },
  '.scss': { mime: 'text/x-scss', kind: 'file' },
  '.less': { mime: 'text/x-less', kind: 'file' },
  '.js':   { mime: 'application/javascript', kind: 'file' },
  '.jsx':  { mime: 'text/jsx', kind: 'file' },
  '.ts':   { mime: 'application/typescript', kind: 'file' },
  '.tsx':  { mime: 'text/tsx', kind: 'file' },
  '.mjs':  { mime: 'application/javascript', kind: 'file' },
  '.cjs':  { mime: 'application/javascript', kind: 'file' },
  '.py':   { mime: 'text/x-python', kind: 'file' },
  '.go':   { mime: 'text/x-go', kind: 'file' },
  '.rs':   { mime: 'text/x-rust', kind: 'file' },
  '.java': { mime: 'text/x-java', kind: 'file' },
  '.kt':   { mime: 'text/x-kotlin', kind: 'file' },
  '.swift':{ mime: 'text/x-swift', kind: 'file' },
  '.c':    { mime: 'text/x-c', kind: 'file' },
  '.h':    { mime: 'text/x-c', kind: 'file' },
  '.cpp':  { mime: 'text/x-c++', kind: 'file' },
  '.hpp':  { mime: 'text/x-c++', kind: 'file' },
  '.cs':   { mime: 'text/x-csharp', kind: 'file' },
  '.rb':   { mime: 'text/x-ruby', kind: 'file' },
  '.php':  { mime: 'text/x-php', kind: 'file' },
  '.sh':   { mime: 'application/x-sh', kind: 'file' },
  '.bash': { mime: 'application/x-sh', kind: 'file' },
  '.zsh':  { mime: 'application/x-sh', kind: 'file' },
  '.sql':  { mime: 'application/sql', kind: 'file' },
  '.log':  { mime: 'text/plain', kind: 'file' },
  '.env':  { mime: 'text/plain', kind: 'file' },
  '.gitignore': { mime: 'text/plain', kind: 'file' },

  '.png':  { mime: 'image/png', kind: 'image' },
  '.jpg':  { mime: 'image/jpeg', kind: 'image' },
  '.jpeg': { mime: 'image/jpeg', kind: 'image' },
  '.gif':  { mime: 'image/gif', kind: 'image' },
  '.webp': { mime: 'image/webp', kind: 'image' },
  '.svg':  { mime: 'image/svg+xml', kind: 'image' },
  '.bmp':  { mime: 'image/bmp', kind: 'image' },
  '.ico':  { mime: 'image/x-icon', kind: 'image' },
  '.heic': { mime: 'image/heic', kind: 'image' },

  '.mp3':  { mime: 'audio/mpeg', kind: 'audio' },
  '.wav':  { mime: 'audio/wav', kind: 'audio' },
  '.flac': { mime: 'audio/flac', kind: 'audio' },
  '.aac':  { mime: 'audio/aac', kind: 'audio' },
  '.ogg':  { mime: 'audio/ogg', kind: 'audio' },
  '.m4a':  { mime: 'audio/mp4', kind: 'audio' },

  '.mp4':  { mime: 'video/mp4', kind: 'video' },
  '.mov':  { mime: 'video/quicktime', kind: 'video' },
  '.webm': { mime: 'video/webm', kind: 'video' },
  '.mkv':  { mime: 'video/x-matroska', kind: 'video' },
  '.avi':  { mime: 'video/x-msvideo', kind: 'video' },

  '.pdf':  { mime: 'application/pdf', kind: 'file' },
  '.doc':  { mime: 'application/msword', kind: 'file' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'file' },
  '.xls':  { mime: 'application/vnd.ms-excel', kind: 'file' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'file' },
  '.ppt':  { mime: 'application/vnd.ms-powerpoint', kind: 'file' },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'file' },
};

function inferMimeAndKind(filePath: string): { mime: string; kind: AttachmentKind } {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? { mime: 'application/octet-stream', kind: 'file' };
}

/**
 * 给定路径 stat 校验 + 推断元信息；不存在或非文件返回 null。
 * 路径会被 resolve 成绝对路径。
 */
export async function inferAttachmentFromPath(rawPath: string): Promise<Attachment | null> {
  const resolved = resolve(rawPath);
  let st;
  try {
    st = await stat(resolved);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;

  const { mime, kind } = inferMimeAndKind(resolved);
  return {
    id: randomUUID(),
    path: resolved,
    name: basename(resolved),
    size: st.size,
    mimeType: mime,
    kind,
  };
}
