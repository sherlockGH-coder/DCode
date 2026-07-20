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

/** absPath 是否落在该对话已审批过的任一目录内 */
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

/** 把绝对目录加入会话白名单 */
export function addAllowedDirToSession(
  conversationId: string | null | undefined,
  absDir: string,
): void {
  if (!conversationId) return;
  getOrCreate(conversationId).add(absDir);
}

/** 对话删除/中断时清空，避免长会话泄露内存 */
export function clearSessionAllowList(conversationId: string): void {
  allowedDirs.delete(conversationId);
}
