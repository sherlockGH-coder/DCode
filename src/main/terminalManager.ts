import { ipcMain, app, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import { userInfo, hostname } from 'node:os';
import { spawn as ptySpawn, type IPty } from 'node-pty';
import { TerminalOutputBuffer } from './terminal/outputBuffer';

interface TerminalSession {
  pty: IPty;
  sender: WebContents;
  /** 回放缓冲：attach 时把断连期间的输出补给渲染进程 */
  buffer: TerminalOutputBuffer;
  /** attach 之后才开始向 sender 推送 */
  attached: boolean;
  /** 尚未发送的输出分片，按 FLUSH_INTERVAL_MS 合并成一条 IPC */
  pending: string[];
  flushTimer: NodeJS.Timeout | null;
}

const sessions = new Map<string, TerminalSession>();

/** 已经挂过 destroyed 监听的 WebContents，避免重复注册 */
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
 * 输出合批窗口。PTY 的 onData 在高输出量下每秒可触发数百次，
 * 逐个 chunk 发 IPC 会淹没渲染进程；按一帧的节奏合并成一条即可。
 */
const FLUSH_INTERVAL_MS = 16;

function clearFlushTimer(s: TerminalSession): void {
  if (s.flushTimer !== null) {
    clearTimeout(s.flushTimer);
    s.flushTimer = null;
  }
}

/** 立即把待发送分片合并成一条 IPC 发出。 */
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

/** 关闭并回收全部终端会话。应用退出前调用，避免留下孤儿 shell 进程。 */
export function killAllTerminalSessions(): void {
  for (const sessionId of [...sessions.keys()]) {
    killSession(sessionId);
  }
}

/**
 * 窗口销毁时回收绑定在它上面的会话。
 *
 * 之前只有显式 `terminal:kill` 和 PTY 自然退出两条清理路径，
 * 关掉一个带活跃终端的窗口会让 shell 进程和它的 256KB 缓冲永久留在内存里。
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
          // 先把残余输出发完，再报退出，避免丢掉最后一屏
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

    // 回放已缓冲的输出；pending 里的内容已经在 buffer 中，清掉避免重复
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
