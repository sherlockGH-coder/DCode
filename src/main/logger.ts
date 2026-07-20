import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

let LOG_DIR: string | null = null;

function ensureLogDir(): string {
  if (!LOG_DIR) {
    const LOG_BASE = app.isPackaged ? app.getPath('userData') : process.cwd();
    LOG_DIR = path.join(LOG_BASE, 'logs');
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch (err) {
      console.error('[logger] 创建日志目录失败:', err);
    }
  }
  return LOG_DIR;
}

function todaysLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(ensureLogDir(), `chat-${date}.jsonl`);
}

export type ChatLogEventName =
  | 'chat_request'
  | 'round_request'
  | 'round_response'
  | 'tool_call'
  | 'approval'
  | 'chat_done'
  | 'error';

export interface ChatLogPayload {
  traceId: string;
  conversationId?: string | null;
  [key: string]: unknown;
}

export function logChatEvent(event: ChatLogEventName, payload: ChatLogPayload): void {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload,
    }) + '\n';
    fs.appendFileSync(todaysLogFile(), line, 'utf-8');
  } catch (err) {

    console.error('[logger] 写日志失败:', err);
  }
}

export function getLogDir(): string {
  return ensureLogDir();
}

const DEBUG_ENABLED = process.env.DCODE_DEBUG === '1' || process.env.DCODE_DEBUG === 'true';

export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}

/** 调试日志：仅在 DCODE_DEBUG=1 时输出到控制台 */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (DEBUG_ENABLED) console.log(`[${scope}]`, ...args);
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatCurlCommand(params: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}): string {
  const lines = [`curl ${shellSingleQuote(params.url)}`];
  for (const [key, value] of Object.entries(params.headers)) {
    lines.push(`  -H ${shellSingleQuote(`${key}: ${value}`)}`);
  }
  lines.push(`  -d ${shellSingleQuote(JSON.stringify(params.body, null, 2))}`);
  return lines.join(' \\\n');
}
