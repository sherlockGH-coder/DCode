import { ipcRenderer } from 'electron';
import { subscribeFiltered } from '../bridge';

export const terminalApi = {
  /** Create a PTY session; return { sessionId, pid, cwd, shell, userLabel }. */
  create: (
    sessionId: string,
    opts?: { cwd?: string | null; cols?: number; rows?: number },
  ): Promise<{
    sessionId: string;
    pid: number;
    cwd: string;
    shell: string;
    userLabel: string;
  }> => {
    return ipcRenderer.invoke('terminal:create', sessionId, opts ?? {});
  },

  /** Call after the renderer subscribes to onData so the main process replays buffered data since creation. */
  attach: (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:attach', sessionId);
  },

  /** Write keyboard input to the PTY. */
  write: (sessionId: string, data: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:write', sessionId, data);
  },

  /** Resize the PTY (cols/rows). */
  resize: (sessionId: string, cols: number, rows: number): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:resize', sessionId, cols, rows);
  },

  /** Close and clean up the PTY. */
  kill: (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:kill', sessionId);
  },

  /** Subscribe to PTY output, filtered by sessionId. */
  onData: (
    sessionId: string,
    callback: (data: string) => void,
  ): (() => void) => {
    return subscribeFiltered('terminal:data', sessionId, callback);
  },

  /** Subscribe to PTY exit events. */
  onExit: (
    sessionId: string,
    callback: (info: { exitCode: number; signal?: number }) => void,
  ): (() => void) => {
    return subscribeFiltered('terminal:exit', sessionId, callback);
  },
};
