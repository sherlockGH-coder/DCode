const DEBUG_ENABLED = process.env.DCODE_DEBUG === '1' || process.env.DCODE_DEBUG === 'true';

/** 调试日志：仅在 DCODE_DEBUG=1 时输出到控制台 */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (DEBUG_ENABLED) console.log(`[${scope}]`, ...args);
}
