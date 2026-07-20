import { useState, useEffect } from 'react';
import { usePanel } from './usePanel';

export function useBottomPanel() {
  const [maxSize, setMaxSize] = useState(() => window.innerHeight * 0.5);

  useEffect(() => {
    const onResize = () => setMaxSize(window.innerHeight * 0.5);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return usePanel({
    localStorageKey: 'bottom-panel',
    defaultSize: 240,
    minSize: 160,
    maxSize,
    direction: 'vertical',
    defaultCollapsed: true,
    persistCollapsed: false,
  });
}
