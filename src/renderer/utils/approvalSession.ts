const sessionAllowedKeys = new Set<string>();

/** Take the first token of a command, for example `git status -s` -> `git`. */
function firstToken(command: string): string {
  return command.trim().split(/\s+/)[0] ?? '';
}

/** Calculate the session allowlist key from an approval request. */
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
