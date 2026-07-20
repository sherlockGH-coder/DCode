const sessionAllowedKeys = new Set<string>();

/** 取命令的第一个 token（例如 `git status -s` → `git`） */
function firstToken(command: string): string {
  return command.trim().split(/\s+/)[0] ?? '';
}

/** 根据 approval 请求计算会话白名单 key */
export function keyForApproval(kind: string, command: string): string {
  if (kind === 'bash_exec') {
    const token = firstToken(command);
    return token ? `bash:${token}` : '';
  }
  if (kind === 'external_tool') {
    return command ? `external:${command}` : '';
  }
  return `tool:${kind}`;
}

export function rememberSessionAllow(key: string): void {
  if (key) sessionAllowedKeys.add(key);
}

export function matchesSessionAllow(key: string): boolean {
  return !!key && sessionAllowedKeys.has(key);
}

export function clearSessionAllow(): void {
  sessionAllowedKeys.clear();
}
