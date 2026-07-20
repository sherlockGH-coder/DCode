import {
  BASE_STREAM_RETRY_DELAY_MS,
  MAX_STREAM_RETRIES,
  MAX_STREAM_RETRY_DELAY_MS,
} from './constants';

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function getErrorStatus(error: any): number {
  return error?.status ?? error?.statusCode ?? error?.response?.status ?? 0;
}
function getErrorCode(error: any): string | undefined {
  return error?.code ?? error?.cause?.code ?? error?.cause?.cause?.code;
}

export function getRetryDelayMs(attempt: number): number {
  return Math.min(BASE_STREAM_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_STREAM_RETRY_DELAY_MS);
}

export function getRetryReason(error: any): string {
  const status = getErrorStatus(error);
  if (status) return `HTTP ${status}`;

  const code = getErrorCode(error);
  if (code) return code;

  const message = typeof error?.message === 'string' ? error.message : String(error);
  return message.slice(0, 80) || '网络错误';
}

export function isRetryableStreamError(error: any, attempt: number): boolean {
  if (attempt >= MAX_STREAM_RETRIES) return false;

  const status = getErrorStatus(error);
  if (status === 429 || status === 529 || (status >= 500 && status < 600)) return true;

  const code = getErrorCode(error);
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;

  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket hang up') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('rate_limit')
  );
}
