export interface PreviewItem {
  type: 'code' | 'html' | 'image' | 'markdown' | 'diff';
  title: string;
  content: string;
  language?: string;
  filePath?: string;
  initialLine?: number;
}
