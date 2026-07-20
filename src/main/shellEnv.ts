import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PROXY_ENV_KEYS } from './proxyEnv';
import { debugLog } from './logger';

const MARKER = '___DCODE_SHELL_ENV_MARKER_97531___';

const KEYS_TO_MERGE = [
  'PATH',
  'HOME',

  'NVM_DIR',
  'NVM_BIN',
  'NVM_INC',
  'VOLTA_HOME',
  'FNM_DIR',
  'FNM_MULTISHELL_PATH',
  'PNPM_HOME',
  'BUN_INSTALL',

  'CARGO_HOME',
  'GOPATH',
  'GOROOT',
  'JAVA_HOME',
  'PYENV_ROOT',
  'RBENV_ROOT',
  'DENO_INSTALL',

  ...PROXY_ENV_KEYS,
];

function pickShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  const fromEnv = process.env.SHELL;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync('/bin/zsh')) return '/bin/zsh';
  if (existsSync('/bin/bash')) return '/bin/bash';
  return '/bin/sh';
}

function dumpShellEnv(shell: string): string | null {
  const script = `printf '%s\\n' '${MARKER}' && env && printf '%s\\n' '${MARKER}'`;

  const result = spawnSync(shell, ['-i', '-l', '-c', script], {
    encoding: 'utf-8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });

  if (result.error) {
    console.warn('[shellEnv] Shell spawn failed:', result.error.message);
    return null;
  }

  if (result.status !== 0) {
    console.warn(
      `[shellEnv] Shell exited with status ${result.status}:`,
      result.stderr?.trim() || '(no stderr)',
    );
    return null;
  }

  const output = result.stdout || '';
  const startIdx = output.indexOf(MARKER);
  const endIdx = output.lastIndexOf(MARKER);

  if (startIdx === -1 || startIdx === endIdx) {
    console.warn(
      '[shellEnv] Markers not found. stdout length:',
      output.length,
      'stderr:',
      result.stderr?.trim() || '(none)',
    );
    return null;
  }

  return output.slice(startIdx + MARKER.length, endIdx).trim();
}

function parseEnvBlock(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    out[line.slice(0, eqIdx)] = line.slice(eqIdx + 1);
  }
  return out;
}

export function resolveShellEnvironment(): void {
  if (process.platform === 'win32') return;

  const shell = pickShell();
  debugLog('shellEnv', 'Resolving environment via', shell);

  const envBlock = dumpShellEnv(shell);
  if (envBlock === null) return;

  const shellEnv = parseEnvBlock(envBlock);

  let merged = 0;
  for (const key of KEYS_TO_MERGE) {
    if (shellEnv[key] && shellEnv[key] !== process.env[key]) {
      process.env[key] = shellEnv[key];
      merged++;
    }
  }

  debugLog('shellEnv', `Merged ${merged} environment variable(s) from shell`);
}
