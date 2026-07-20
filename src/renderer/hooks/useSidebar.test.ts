import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSidebar } from './useSidebar';

const SidebarWidthProbe: React.FC = () => {
  const sidebar = useSidebar();
  return React.createElement('output', { 'data-testid': 'sidebar-width' }, sidebar.width);
};

describe('useSidebar', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    const storage = new Map<string, string>();

    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        key: (index: number) => [...storage.keys()][index] ?? null,
        get length() {
          return storage.size;
        },
      },
      IS_REACT_ACT_ENVIRONMENT: true,
    });

    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
  });

  it('uses the resize minimum as the initial width when no width was stored', async () => {
    await act(async () => {
      root?.render(React.createElement(SidebarWidthProbe));
    });

    expect(container.querySelector('[data-testid="sidebar-width"]')?.textContent).toBe('250');
  });
});
