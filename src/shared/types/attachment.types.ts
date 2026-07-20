/** 附件大类：file 可通过 read_file 读取；image/audio/video 作为用户附件元数据保留。 */
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
