import { ipcMain, app, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import { userInfo, hostname } from 'node:os';
import { spawn as ptySpawn, type IPty } from 'node-pty';

interface TerminalSession {
  pty: IPty;
  sender: WebContents;
  /** attach 之前累积的输出；attach 后清空、不再使用 */
  buffer: string;
  /** attach 之后才开始向 sender 直接 send，之前都进 buffer */
  attached: boolean;
}

const sessions = new Map<string, TerminalSession>();

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

function killSession(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s) return;
  sessions.delete(sessionId);
  try { s.pty.kill(); } catch {              }
}

const MAX_BUFFER = 256 * 1024;

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
        buffer: '',
        attached: false,
      };
      sessions.set(sessionId, session);

      pty.onData((data) => {
        const cur = sessions.get(sessionId);
        if (!cur) return;

        cur.buffer += data;
        if (cur.buffer.length > MAX_BUFFER) {
          cur.buffer = cur.buffer.slice(-MAX_BUFFER);
        }

        if (cur.attached && !cur.sender.isDestroyed()) {
          cur.sender.send('terminal:data', sessionId, data);
        }
      });

      pty.onExit(({ exitCode, signal }) => {
        const cur = sessions.get(sessionId);
        if (cur && !cur.sender.isDestroyed()) {
          cur.sender.send('terminal:exit', sessionId, { exitCode, signal });
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
    if (s.buffer && !s.sender.isDestroyed()) {
      s.sender.send('terminal:data', sessionId, s.buffer);
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
