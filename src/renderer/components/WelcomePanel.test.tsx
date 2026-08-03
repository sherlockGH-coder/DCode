import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomePanel from './WelcomePanel';

describe('WelcomePanel', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLButtonElement: (window as any).HTMLButtonElement,
      Event: window.Event,
      Node: window.Node,
      SVGElement: (window as any).SVGElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    vi.restoreAllMocks();
  });

  it('renders the four welcome actions without legacy helper text', () => {
    act(() => root?.render(<WelcomePanel onQuickAction={vi.fn()} />));

    expect(container.textContent).toContain('What do you want to build?');
    expect(container.textContent).toContain('From idea to implementation, AI works with you');
    expect(container.querySelectorAll('.welcome-action-card')).toHaveLength(4);
    expect(container.querySelector('button[aria-label="Explore: Explore and analyze the architecture and core implementation of this codebase"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Build: Build a new feature module:"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Fix: Inspect and fix issues in the code:"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Review: Review recent code changes and suggest improvements"]')).not.toBeNull();
    expect(container.textContent).not.toContain('DCode Workbench');
    expect(container.textContent).not.toContain('Press Enter to run');
  });

  it('passes the selected prompt to the composer integration', () => {
    const onQuickAction = vi.fn();
    act(() => root?.render(<WelcomePanel onQuickAction={onQuickAction} />));

    const buildButton = container.querySelector('button[aria-label="Build: Build a new feature module:"]') as HTMLButtonElement;
    act(() => buildButton.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(onQuickAction).toHaveBeenCalledWith('Build a new feature module:');
  });
});
