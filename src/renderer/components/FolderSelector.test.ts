import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../shared/types';
import FolderSelector from './FolderSelector';

describe('FolderSelector', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  const projects: Project[] = [
    {
      path: '/Users/conan/Code/OS',
      name: 'OS',
      environment: 'local',
      addedAt: 1,
    },
  ];

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLButtonElement: (window as any).HTMLButtonElement,
      HTMLInputElement: (window as any).HTMLInputElement,
      Event: window.Event,
      Node: window.Node,
      SVGElement: (window as any).SVGElement,
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
    vi.restoreAllMocks();
  });

  it('opens upward and toward the main content instead of behind the sidebar', () => {
    act(() => {
      root?.render(React.createElement(FolderSelector, {
        variant: 'inline',
        placement: 'top',
        projects,
        activeProject: projects[0].path,
        onSelectProject: vi.fn(),
        onAddExistingProject: vi.fn(async () => null),
        onCreateProject: vi.fn(async () => null),
        onPickProjectParent: vi.fn(async () => null),
      }));
    });

    const trigger = container.querySelector('button');
    act(() => {
      trigger?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const menu = container.querySelector('[data-testid="folder-selector-menu"]');
    expect(menu?.className).toContain('bottom-full');
    expect(menu?.className).toContain('left-0');
    expect(menu?.className).not.toContain('top-full');
    expect(menu?.className).not.toContain('right-0');
  });
});
