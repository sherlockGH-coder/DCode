const DEBUG_ENABLED = process.env.DCODE_DEBUG === '1' || process.env.DCODE_DEBUG === 'true';

/** Debug logging, emitted to the console only when DCODE_DEBUG=1. */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (DEBUG_ENABLED) console.log(`[${scope}]`, ...args);
}
