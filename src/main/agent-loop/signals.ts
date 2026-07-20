export function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter((item): item is AbortSignal => !!item);
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];

  const controller = new AbortController();
  const listeners: Array<() => void> = [];

  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
      listeners.forEach(cleanup => cleanup());
    }
  };

  for (const activeSignal of activeSignals) {
    if (activeSignal.aborted) {
      abort();
      break;
    }
    activeSignal.addEventListener('abort', abort, { once: true });
    listeners.push(() => activeSignal.removeEventListener('abort', abort));
  }

  return controller.signal;
}

/** 等待退避时间；用户中止时立即返回 false，避免 UI 已停止但 loop 仍在休眠。 */
export function waitForAbortableDelay(delayMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), Math.max(0, delayMs));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
