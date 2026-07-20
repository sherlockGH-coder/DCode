import { ipcRenderer } from 'electron';
import { subscribeFiltered } from '../bridge';

export const terminalApi = {
  /** 创建一个新 PTY 会话；返回 { sessionId, pid, cwd, shell, userLabel } */
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

  /** 渲染端订阅好 onData 后调用：让主进程把建好之后到现在的缓冲数据回放过来 */
  attach: (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:attach', sessionId);
  },

  /** 向 PTY 写入键盘输入 */
  write: (sessionId: string, data: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:write', sessionId, data);
  },

  /** 调整 PTY 尺寸（cols/rows） */
  resize: (sessionId: string, cols: number, rows: number): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:resize', sessionId, cols, rows);
  },

  /** 关闭并清理 PTY */
  kill: (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke('terminal:kill', sessionId);
  },

  /** 订阅 PTY 输出（按 sessionId 过滤） */
  onData: (
    sessionId: string,
    callback: (data: string) => void,
  ): (() => void) => {
    return subscribeFiltered('terminal:data', sessionId, callback);
  },

  /** 订阅 PTY 退出事件 */
  onExit: (
    sessionId: string,
    callback: (info: { exitCode: number; signal?: number }) => void,
  ): (() => void) => {
    return subscribeFiltered('terminal:exit', sessionId, callback);
  },
};
