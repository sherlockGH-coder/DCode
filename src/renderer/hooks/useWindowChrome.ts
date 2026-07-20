import { useEffect, useState, useMemo } from 'react';

export function useWindowChrome() {
  const isMacOS = window.electronEnv?.platform === 'darwin';
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isMacOS) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    window.electronEnv?.isFullScreen().then((v) => {
      if (!disposed) setIsFullscreen(v);
    }).catch(() => {

    });

    unsubscribe = window.electronEnv?.onFullscreenChanged((v) => {
      setIsFullscreen(v);
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [isMacOS]);

  return useMemo(() => ({
    isMacOS,
    isFullscreen
  }), [isMacOS, isFullscreen]);
}
