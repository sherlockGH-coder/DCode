import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from './ChatPanel';

describe('ChatPanel automatic scrolling', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let animationFrames: Map<number, FrameRequestCallback>;
  let nextAnimationFrameId: number;

  const flushAnimationFrames = () => {
    const callbacks = [...animationFrames.values()];
    animationFrames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  };

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    animationFrames = new Map();
    nextAnimationFrameId = 1;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrames.set(id, callback);
      return id;
    });
    const cancelAnimationFrame = vi.fn((id: number) => {
      animationFrames.delete(id);
    });

    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      SVGElement: (window as any).SVGElement,
      requestAnimationFrame,
      cancelAnimationFrame,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.assign(window, { requestAnimationFrame, cancelAnimationFrame });

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

  it('releases upward scrolling immediately and resumes after the user returns to the bottom', () => {
    act(() => {
      root?.render(React.createElement(ChatPanel, {
        items: [React.createElement('div', { key: 'message' }, 'Streaming response')],
        contentVersion: 1,
        bottomPadding: 0,
      }));
    });

    const panel = container.querySelector('.chat-panel') as HTMLDivElement;
    let scrollTop = 0;
    let scrollHeight = 1_000;
    const clientHeight = 500;
    Object.defineProperties(panel, {
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.max(0, Math.min(value, scrollHeight - clientHeight));
        },
      },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, get: () => clientHeight },
    });

    act(flushAnimationFrames);
    expect(scrollTop).toBe(500);

    const upwardWheel = new window.Event('wheel');
    Object.defineProperty(upwardWheel, 'deltaY', { value: -1 });
    act(() => panel.dispatchEvent(upwardWheel));

    scrollHeight = 1_200;
    act(() => {
      root?.render(React.createElement(ChatPanel, {
        items: [React.createElement('div', { key: 'message' }, 'Streaming response continued')],
        contentVersion: 2,
        bottomPadding: 0,
      }));
    });
    act(flushAnimationFrames);
    expect(scrollTop).toBe(500);

    scrollTop = 700;
    act(() => panel.dispatchEvent(new window.Event('scroll')));

    scrollHeight = 1_400;
    act(() => {
      root?.render(React.createElement(ChatPanel, {
        items: [React.createElement('div', { key: 'message' }, 'Streaming response finished')],
        contentVersion: 3,
        bottomPadding: 0,
      }));
    });
    act(flushAnimationFrames);
    expect(scrollTop).toBe(900);

    scrollTop = 870;
    act(() => panel.dispatchEvent(new window.Event('scroll')));

    scrollHeight = 1_600;
    act(() => {
      root?.render(React.createElement(ChatPanel, {
        items: [React.createElement('div', { key: 'message' }, 'More streaming content')],
        contentVersion: 4,
        bottomPadding: 0,
      }));
    });
    act(flushAnimationFrames);
    expect(scrollTop).toBe(870);
  });

  it('exposes the transcript as a keyboard-focusable scroll region', () => {
    act(() => {
      root?.render(React.createElement(ChatPanel, { items: [], contentVersion: 0 }));
    });

    const panel = container.querySelector('.chat-panel') as HTMLDivElement;
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-label')).toBe('对话内容');
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(panel.classList.contains('custom-scrollbar')).toBe(true);
  });
});
