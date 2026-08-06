import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModelSelector from './ModelSelector';

describe('ModelSelector', () => {
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

  const renderSelector = (overrides: Partial<React.ComponentProps<typeof ModelSelector>> = {}) => {
    const props: React.ComponentProps<typeof ModelSelector> = {
      isWelcomeStyle: true,
      isOpen: true,
      menuRef: { current: null },
      reasoningEffort: 'high',
      isLoading: false,
      models: ['model-a', 'model-b'],
      selectedModel: 'model-a',
      selectedProvider: 'DeepSeek',
      providers: [
        {
          profileId: 'default',
          providerName: 'DeepSeek',
          models: ['model-a', 'model-b'],
          isActive: true,
        },
      ],
      onOpenChange: vi.fn(),
      onModelChange: vi.fn(),
      onReasoningEffortChange: vi.fn(),
      ...overrides,
    };
    act(() => root?.render(React.createElement(ModelSelector, props)));
    return props;
  };

  it('displays provider/model format in trigger label', () => {
    renderSelector({ isOpen: false });

    const trigger = container.querySelector('[aria-label="Select model"]');
    expect(trigger?.textContent).toContain('DeepSeek/model-a');
  });

  it('shows provider list in level 1 menu', () => {
    renderSelector();

    const menu = container.querySelector('[data-testid="model-selector-menu"]');
    expect(menu?.textContent).toContain('DeepSeek');
  });

  it('opens model submenu on provider hover and triggers onModelChange with profileId', () => {
    const props = renderSelector();
    const providerRow = container.querySelector('[aria-label="Provider DeepSeek"]');

    act(() => {
      providerRow?.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
      providerRow?.dispatchEvent(new window.Event('mouseover', { bubbles: true }));
    });

    const submenu = container.querySelector('[data-testid="model-submenu"]');
    expect(submenu?.textContent ?? '').toContain('model-a');
    expect(submenu?.textContent ?? '').toContain('model-b');

    const modelB = Array.from(submenu?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('model-b'));
    act(() => modelB?.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(props.onModelChange).toHaveBeenCalledWith('model-b', 'default');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('aligns the model submenu with the hovered provider row', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-testid') === 'model-selector-menu') {
        return { top: 100 } as DOMRect;
      }
      if (this.getAttribute('aria-label') === 'Provider Provider A') {
        return { top: 140 } as DOMRect;
      }
      if (this.getAttribute('aria-label') === 'Provider Provider B') {
        return { top: 192 } as DOMRect;
      }
      return { top: 0 } as DOMRect;
    });

    renderSelector({
      providers: [
        { profileId: 'provider-a', providerName: 'Provider A', models: ['model-a'], isActive: true },
        { profileId: 'provider-b', providerName: 'Provider B', models: ['model-b'], isActive: false },
      ],
    });

    const providerA = container.querySelector('[aria-label="Provider Provider A"]');
    act(() => {
      providerA?.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
      providerA?.dispatchEvent(new window.Event('mouseover', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="model-submenu"]')?.getAttribute('style')).toContain('top:40px');

    const providerB = container.querySelector('[aria-label="Provider Provider B"]');
    act(() => {
      providerB?.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
      providerB?.dispatchEvent(new window.Event('mouseover', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="model-submenu"]')?.getAttribute('style')).toContain('top:92px');
  });

  it('opens effort submenu on model hover and updates effort', () => {
    const props = renderSelector({ reasoningEffort: 'high' });
    const providerRow = container.querySelector('[aria-label="Provider DeepSeek"]');

    act(() => {
      providerRow?.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
      providerRow?.dispatchEvent(new window.Event('mouseover', { bubbles: true }));
    });

    const modelSubmenu = container.querySelector('[data-testid="model-submenu"]');
    const modelA = Array.from(modelSubmenu?.querySelectorAll('button') ?? [])[0];

    act(() => {
      modelA?.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
      modelA?.dispatchEvent(new window.Event('mouseover', { bubbles: true }));
    });

    const effortSubmenu = container.querySelector('[data-testid="effort-submenu"]');
    const options = Array.from(effortSubmenu?.querySelectorAll('button') ?? []);
    expect(options.map((button) => button.textContent?.trim())).toEqual(['Off', 'High', 'Max']);

    act(() => options[0]?.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(props.onReasoningEffortChange).toHaveBeenCalledWith(undefined);
    expect(props.onModelChange).toHaveBeenCalledWith('model-a', 'default');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not include manage models entry', () => {
    renderSelector();

    const menu = container.querySelector('[data-testid="model-selector-menu"]');
    expect(menu?.textContent).not.toContain('Manage models');
  });
});
