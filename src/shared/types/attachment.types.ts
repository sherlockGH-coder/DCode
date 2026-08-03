/** Attachment categories: file can be read with read_file; image/audio/video are retained as user-attachment metadata. */
export type AttachmentKind = 'file' | 'image' | 'audio' | 'video';

export interface Attachment {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  kind: AttachmentKind;
}

export type FileOpenTarget = 'default' | 'app' | 'reveal';

export interface FileOpenResult {
  success: boolean;
  target: FileOpenTarget;
  name?: string;
  error?: string;
}

export interface FileOpenOption {
  id: string;
  name: string;
  target: FileOpenTarget;
  iconDataUrl?: string;
  opensDirectory?: boolean;
}
