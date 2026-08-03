import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../../shared/types';
import PermissionsSection from './PermissionsSection';

function settingsWithPolicy(policy: AppSettings['permissions']['bashExec']): AppSettings {
  return {
    permissions: {
      bashExec: policy,
      bashWhitelist: [],
      skills: { disabled: [] },
    },
  } as unknown as AppSettings;
}

describe('PermissionsSection', () => {
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
      KeyboardEvent: window.KeyboardEvent,
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

  it('renders the three permission modes as a minimal radio list', () => {
    act(() => root?.render(React.createElement(PermissionsSection, {
      settings: settingsWithPolicy('default'),
      patch: vi.fn(),
    })));

    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(container.textContent).toContain('Auto-allow file operations');
    expect(container.textContent).toContain('Full access');
  });

  it('saves ordinary modes immediately', async () => {
    const patch = vi.fn(async () => undefined);
    act(() => root?.render(React.createElement(PermissionsSection, {
      settings: settingsWithPolicy('default'),
      patch,
    })));

    const autoReview = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((button) => button.textContent?.includes('Auto-allow file operations'));
    await act(async () => {
      autoReview?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(patch).toHaveBeenCalledWith({ permissions: { bashExec: 'auto_review' } });
  });

  it('requires icon-free confirmation before enabling full access', async () => {
    const patch = vi.fn(async () => undefined);
    act(() => root?.render(React.createElement(PermissionsSection, {
      settings: settingsWithPolicy('default'),
      patch,
    })));

    const fullAccess = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((button) => button.textContent?.includes('Full access'));
    act(() => fullAccess?.dispatchEvent(new window.Event('click', { bubbles: true })));

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('svg')).toBeNull();
    expect(patch).not.toHaveBeenCalled();

    const cancel = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Cancel');
    act(() => cancel?.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(patch).not.toHaveBeenCalled();

    act(() => fullAccess?.dispatchEvent(new window.Event('click', { bubbles: true })));
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'Enable full access');
    await act(async () => {
      confirm?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(patch).toHaveBeenCalledWith({ permissions: { bashExec: 'full_access' } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the risk warning when full access is active', () => {
    act(() => root?.render(React.createElement(PermissionsSection, {
      settings: settingsWithPolicy('full_access'),
      patch: vi.fn(),
    })));

    expect(container.textContent).toContain('Full access is enabled');
    expect(container.textContent).toContain('Risk notice');
  });

  it('keeps the confirmation open when enabling full access fails', async () => {
    const patch = vi.fn(async () => { throw new Error('Save failed'); });
    act(() => root?.render(React.createElement(PermissionsSection, {
      settings: settingsWithPolicy('default'),
      patch,
    })));

    const fullAccess = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((button) => button.textContent?.includes('Full access'));
    act(() => fullAccess?.dispatchEvent(new window.Event('click', { bubbles: true })));
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent === 'Enable full access');

    await act(async () => {
      confirm?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('Save failed');
  });
});
