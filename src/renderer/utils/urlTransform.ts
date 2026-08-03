import { defaultUrlTransform } from 'react-markdown';

const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|avif)/i;

/**
 * urlTransform callback for react-markdown.
 * 1. Allow inline image URIs such as data:image/png and data:image/jpeg.
 * 2. Block other data: URIs, such as data:text/html containing scripts.
 * 3. Delegate javascript:, vbscript:, and similar schemes to defaultUrlTransform.
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
