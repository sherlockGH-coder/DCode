import { defaultUrlTransform } from 'react-markdown';

const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|avif)/i;

/**
 * react-markdown 的 urlTransform 回调。
 * 1. 放行 data:image/png, data:image/jpeg 等内联图片 URI
 * 2. 阻止其他 data: URI（如 data:text/html 含脚本）
 * 3. 委托 defaultUrlTransform 处理 javascript:, vbscript: 等
 */
export function safeUrlTransform(value: string): string {
  if (!value) return value;

  if (value.startsWith('file://')) {
    return value.replace('file://', 'local-file://');
  }

  if (SAFE_DATA_IMAGE.test(value)) return value;

  if (value.startsWith('data:')) return '';

  return defaultUrlTransform(value);
}
