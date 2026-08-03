import { useEffect, useState, useMemo } from 'react';

export function useWindowChrome() {
  const isMacOS = window.electronEnv?.platform === 'darwin';
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isMacOS) return;

    let disposed = false;

    void window.electronEnv?.isFullScreen().then((v) => {
      if (!disposed) setIsFullscreen(v);
    }).catch(() => {
      // Keep the default value when the initial fullscreen state is unavailable.
    });

    const unsubscribe = window.electronEnv?.onFullscreenChanged((v) => {
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
