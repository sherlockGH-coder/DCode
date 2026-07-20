import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerEditorModal from './ServerEditorModal';

describe('ServerEditorModal JSON config', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLTextAreaElement: (window as any).HTMLTextAreaElement,
      HTMLInputElement: (window as any).HTMLInputElement,
      HTMLButtonElement: (window as any).HTMLButtonElement,
      Event: window.Event,
      InputEvent: (window as any).InputEvent ?? window.Event,
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

  it('renders JSON config without a manual parse button', () => {
    act(() => {
      root?.render(React.createElement(ServerEditorModal, {
        scope: 'user',
        initial: null,
        onClose: vi.fn(),
        onSave: vi.fn(),
      }));
    });

    expect(container.textContent).not.toContain('解析并填充');
    expect(container.textContent).toContain('JSON 配置');
  });

  it('does not intercept native paste in the JSON textarea', () => {
    act(() => {
      root?.render(React.createElement(ServerEditorModal, {
        scope: 'user',
        initial: null,
        onClose: vi.fn(),
        onSave: vi.fn(),
      }));
    });

    const jsonTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const pasteEvent = new window.Event('paste', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: (type: string) => string };
    };
    pasteEvent.clipboardData = {
      getData: () => '"env": { "TOKEN": "abc" }',
    };

    act(() => {
      jsonTextarea.dispatchEvent(pasteEvent);
    });

    expect(pasteEvent.defaultPrevented).toBe(false);
  });
});
