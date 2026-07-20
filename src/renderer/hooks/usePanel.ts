import { useState, useCallback, useRef, useMemo } from 'react';

export interface PanelConfig {
  localStorageKey: string;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  direction: 'horizontal' | 'vertical';
  defaultCollapsed?: boolean;
  persistCollapsed?: boolean;
  /** 是否翻转增量逻辑（如右侧面板拉左边缘增加宽度） */
  invertDelta?: boolean;
}

function readStoredSize(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}

function readStoredCollapsed(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

export function usePanel(config: PanelConfig) {
  const {
    localStorageKey,
    defaultSize,
    minSize,
    maxSize,
    direction,
    defaultCollapsed = false,
    persistCollapsed = true,
    invertDelta = false
  } = config;

  const [size, setSizeState] = useState(() =>
    readStoredSize(`${localStorageKey}-size`, defaultSize, minSize, maxSize)
  );
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const panelRef = useRef<HTMLDivElement | null>(null);

  const [collapsed, setCollapsedState] = useState(() =>
    persistCollapsed
      ? readStoredCollapsed(`${localStorageKey}-collapsed`, defaultCollapsed)
      : defaultCollapsed
  );

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    if (!persistCollapsed) return;
    try {
      localStorage.setItem(`${localStorageKey}-collapsed`, next ? '1' : '0');
    } catch {              }
  }, [localStorageKey, persistCollapsed]);

  const setSize = useCallback((next: number) => {
    const clamped = Math.min(maxSize, Math.max(minSize, next));
    setSizeState(clamped);
    try {
      localStorage.setItem(`${localStorageKey}-size`, String(clamped));
    } catch {              }
  }, [localStorageKey, minSize, maxSize]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const isHorizontal = direction === 'horizontal';
    const startPos = isHorizontal ? e.clientX : e.clientY;
    const startSize = sizeRef.current;
    const panel = panelRef.current;

    if (!panel) return;

    panel.style.transition = 'none';

    const onMove = (ev: MouseEvent) => {
      let delta = isHorizontal ? (ev.clientX - startPos) : -(ev.clientY - startPos);
      if (invertDelta) delta = -delta;
      const next = Math.min(maxSize, Math.max(minSize, startSize + delta));
      sizeRef.current = next;

      if (isHorizontal) {
        panel.style.width = `${next}px`;
      } else {
        panel.style.height = `${next}px`;
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      setSizeState(sizeRef.current);
      try {
        localStorage.setItem(`${localStorageKey}-size`, String(sizeRef.current));
      } catch {              }

      requestAnimationFrame(() => {
        panel.style.transition = '';
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, localStorageKey, minSize, maxSize]);

  return useMemo(() => ({
    size,
    collapsed,
    setSize,
    setCollapsed,
    handleResizeStart,
    panelRef,
  }), [size, collapsed, setSize, setCollapsed, handleResizeStart]);
}
