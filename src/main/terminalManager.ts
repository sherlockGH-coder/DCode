import { ipcMain, app, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import { userInfo, hostname } from 'node:os';
import { spawn as ptySpawn, type IPty } from 'node-pty';
import { TerminalOutputBuffer } from './terminal/outputBuffer';

interface TerminalSession {
  pty: IPty;
  sender: WebContents;
  /** Replay buffer: send output accumulated while disconnected when attaching. */
  buffer: TerminalOutputBuffer;
  /** Push to the sender only after attach. */
  attached: boolean;
  /** Output chunks not yet sent, combined into one IPC event per FLUSH_INTERVAL_MS. */
  pending: string[];
  flushTimer: NodeJS.Timeout | null;
}

const sessions = new Map<string, TerminalSession>();

/** WebContents with a destroyed listener already attached, to avoid duplicate registration. */
const watchedSenders = new WeakSet<WebContents>();

function pickShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.COMSPEC || 'cmd.exe', args: [] };
  }
  const fromEnv = process.env.SHELL;
  if (fromEnv && existsSync(fromEnv)) return { file: fromEnv, args: ['-l'] };
  if (existsSync('/bin/zsh')) return { file: '/bin/zsh', args: ['-l'] };
  if (existsSync('/bin/bash')) return { file: '/bin/bash', args: ['-l'] };
  return { file: '/bin/sh', args: [] };
}

function buildShellEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (key.startsWith('npm_')) continue;
    if (key === 'INIT_CWD' || key === 'PROJECT_CWD') continue;
    if (key === 'PNPM_SCRIPT_SRC_DIR' || key === 'PNPM_PACKAGE_NAME') continue;
    env[key] = value;
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  return env;
}

function resolveCwd(input: string | null | undefined): string {
  if (input && existsSync(input)) return input;
  return app.getPath('home');
}

const MAX_BUFFER = 256 * 1024;

/**
 * Output batching window. PTY onData can fire hundreds of times per second with high output;
 * sending one IPC event per chunk can overwhelm the renderer, so combine events at roughly one frame.
 */
const FLUSH_INTERVAL_MS = 16;

function clearFlushTimer(s: TerminalSession): void {
  if (s.flushTimer !== null) {
    clearTimeout(s.flushTimer);
    s.flushTimer = null;
  }
}

/** Immediately combine pending chunks and send one IPC event. */
function flushPending(sessionId: string, s: TerminalSession): void {
  clearFlushTimer(s);
  if (s.pending.length === 0) return;

  const payload = s.pending.join('');
  s.pending.length = 0;

  if (s.attached && !s.sender.isDestroyed()) {
    s.sender.send('terminal:data', sessionId, payload);
  }
}

function scheduleFlush(sessionId: string, s: TerminalSession): void {
  if (s.flushTimer !== null) return;
  s.flushTimer = setTimeout(() => {
    s.flushTimer = null;
    const cur = sessions.get(sessionId);
    if (cur) flushPending(sessionId, cur);
  }, FLUSH_INTERVAL_MS);
}

function killSession(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s) return;
  sessions.delete(sessionId);
  clearFlushTimer(s);
  s.pending.length = 0;
  s.buffer.clear();
  try { s.pty.kill(); } catch {}
}

/** Close and reap all terminal sessions. Call before app exit to avoid orphaned shell processes. */
export function killAllTerminalSessions(): void {
  for (const sessionId of [...sessions.keys()]) {
    killSession(sessionId);
  }
}

/**
 * Reap sessions bound to a window when the window is destroyed.
 *
 * Previously cleanup happened only through explicit `terminal:kill` and natural PTY exit.
 * Closing a window with an active terminal left its shell process and 256 KB buffer in memory.
 */
function killSessionsBoundTo(sender: WebContents): void {
  for (const [sessionId, s] of [...sessions.entries()]) {
    if (s.sender === sender) killSession(sessionId);
  }
}

function watchSender(sender: WebContents): void {
  if (watchedSenders.has(sender)) return;
  watchedSenders.add(sender);
  sender.once('destroyed', () => killSessionsBoundTo(sender));
}

export function registerTerminalIpc() {
  ipcMain.handle(
    'terminal:create',
    (
      event,
      sessionId: string,
      opts: { cwd?: string | null; cols?: number; rows?: number } = {},
    ) => {
      if (sessions.has(sessionId)) killSession(sessionId);

      const { file, args } = pickShell();
      const cwd = resolveCwd(opts.cwd);
      const cols = opts.cols && opts.cols > 0 ? opts.cols : 80;
      const rows = opts.rows && opts.rows > 0 ? opts.rows : 24;

      const pty = ptySpawn(file, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: buildShellEnv(),
      });

      const session: TerminalSession = {
        pty,
        sender: event.sender,
        buffer: new TerminalOutputBuffer(MAX_BUFFER),
        attached: false,
        pending: [],
        flushTimer: null,
      };
      sessions.set(sessionId, session);
      watchSender(event.sender);

      pty.onData((data) => {
        const cur = sessions.get(sessionId);
        if (!cur) return;

        cur.buffer.append(data);

        if (cur.attached && !cur.sender.isDestroyed()) {
          cur.pending.push(data);
          scheduleFlush(sessionId, cur);
        }
      });

      pty.onExit(({ exitCode, signal }) => {
        const cur = sessions.get(sessionId);
        if (cur) {
          // Send remaining output before reporting exit so the final screen is not lost.
          flushPending(sessionId, cur);
          clearFlushTimer(cur);
          if (!cur.sender.isDestroyed()) {
            cur.sender.send('terminal:exit', sessionId, { exitCode, signal });
          }
        }
        sessions.delete(sessionId);
      });

      const userLabel = `${userInfo().username}@${hostname().split('.')[0]}`;
      return { sessionId, pid: pty.pid, cwd, shell: file, userLabel };
    },
  );

  ipcMain.handle('terminal:attach', (event, sessionId: string) => {
    const s = sessions.get(sessionId);
    if (!s) return false;
    s.sender = event.sender;
    s.attached = true;
    watchSender(event.sender);

    // Replay buffered output; pending content is already in the buffer, so clear it to avoid duplicates.
    s.pending.length = 0;
    clearFlushTimer(s);

    const backlog = s.buffer.read();
    if (backlog && !s.sender.isDestroyed()) {
      s.sender.send('terminal:data', sessionId, backlog);
    }
    return true;
  });

  ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => {
    const s = sessions.get(sessionId);
    if (!s) return false;
    s.pty.write(data);
    return true;
  });

  ipcMain.handle(
    'terminal:resize',
    (_event, sessionId: string, cols: number, rows: number) => {
      const s = sessions.get(sessionId);
      if (!s) return false;
      try {
        s.pty.resize(Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows)));
        return true;
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle('terminal:kill', (_event, sessionId: string) => {
    killSession(sessionId);
    return true;
  });
}
