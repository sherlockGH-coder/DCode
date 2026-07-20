import { useState, useCallback, useRef, useMemo } from 'react';

const SIDEBAR_MIN = 250;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = SIDEBAR_MIN;

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem('sidebar-width');
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
    return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === '1';
  } catch {
    return false;
  }
}

export function useSidebar() {
  const [width, setWidth] = useState(readStoredWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const setCollapsedPersist = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
    } catch {              }
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const el = sidebarRef.current;

    if (!el) return;

    el.style.transition = 'none';

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + (ev.clientX - startX)));
      widthRef.current = next;
      el.style.width = `${next}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      setWidth(widthRef.current);
      try {
        localStorage.setItem('sidebar-width', String(widthRef.current));
      } catch {              }

      requestAnimationFrame(() => {
        el.style.transition = '';
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return useMemo(() => ({
    width,
    collapsed,
    setCollapsed: setCollapsedPersist,
    handleResizeStart,
    sidebarRef,
  }), [width, collapsed, setCollapsedPersist, handleResizeStart]);
}
