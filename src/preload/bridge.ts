import { ipcRenderer } from 'electron';

/**
 * 订阅一个 IPC 频道，返回取消订阅函数。
 * 回调只接收业务参数（自动剥离 IpcRendererEvent）。
 */
export function subscribe<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: T) => {
    callback(...args);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * 订阅一个带「首参为 key」的 IPC 频道，只有 key 匹配时才回调（终端按 sessionId 过滤用）。
 * 返回取消订阅函数。
 */
export function subscribeFiltered<T extends unknown[]>(
  channel: string,
  key: string,
  callback: (...args: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, k: string, ...args: T) => {
    if (k === key) callback(...args);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
