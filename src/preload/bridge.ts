import { ipcRenderer } from 'electron';

/**
 * Subscribe to an IPC channel and return an unsubscribe function.
 * The callback receives only business arguments; IpcRendererEvent is stripped automatically.
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
 * Subscribe to an IPC channel whose first argument is a key; invoke the callback only when the key matches.
 * Used to filter terminal events by sessionId. Return an unsubscribe function.
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
