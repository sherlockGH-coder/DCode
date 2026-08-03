import { isPathInsideDir } from './pathSandbox';

const allowedDirs = new Map<string, Set<string>>();

function getOrCreate(convId: string): Set<string> {
  let set = allowedDirs.get(convId);
  if (!set) {
    set = new Set();
    allowedDirs.set(convId, set);
  }
  return set;
}

/** Whether absPath is inside any directory already approved for the conversation. */
export function isPathAllowedInSession(
  conversationId: string | null | undefined,
  absPath: string,
): boolean {
  if (!conversationId) return false;
  const dirs = allowedDirs.get(conversationId);
  if (!dirs || dirs.size === 0) return false;
  for (const dir of dirs) {
    if (isPathInsideDir(absPath, dir)) return true;
  }
  return false;
}

/** Add an absolute directory to the session allowlist. */
export function addAllowedDirToSession(
  conversationId: string | null | undefined,
  absDir: string,
): void {
  if (!conversationId) return;
  getOrCreate(conversationId).add(absDir);
}

/** Clear on conversation deletion or interruption to prevent memory leaks during long sessions. */
export function clearSessionAllowList(conversationId: string): void {
  allowedDirs.delete(conversationId);
}
