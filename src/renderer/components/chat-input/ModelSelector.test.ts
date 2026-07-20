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
      onOpenChange: vi.fn(),
      onModelChange: vi.fn(),
      onReasoningEffortChange: vi.fn(),
      ...overrides,
    };
    act(() => root?.render(React.createElement(ModelSelector, props)));
    return props;
  };

  it('keeps the trigger compact with a blue icon and no effort text', () => {
    renderSelector({ isOpen: false, reasoningEffort: 'max' });

    const trigger = container.querySelector('[aria-label="选择模型"]');
    const icon = trigger?.querySelector('[data-testid="model-selector-icon"]');
    expect(icon?.classList.contains('text-accent')).toBe(true);
    expect(trigger?.textContent).toContain('model-a');
    expect(trigger?.textContent).not.toContain('Max');
  });

  it('shows Model and Effort rows with their current values', () => {
    renderSelector({ reasoningEffort: undefined });

    const menu = container.querySelector('[data-testid="model-selector-menu"]');
    expect(menu?.textContent).toContain('Model');
    expect(menu?.textContent).toContain('model-a');
    expect(menu?.textContent).toContain('Effort');
    expect(menu?.textContent).toContain('Off');
  });

  it('opens the model submenu on hover and marks the selected model', () => {
    const props = renderSelector();
    const modelRow = container.querySelector('[aria-label="选择具体模型"]');

    act(() => modelRow?.dispatchEvent(new window.Event('mouseover', { bubbles: true })));

    const submenu = container.querySelector('[data-testid="model-submenu"]');
    expect(submenu?.textContent).toContain('model-a');
    expect(submenu?.textContent).toContain('model-b');
    expect(submenu?.querySelector('[data-selected="true"] svg')).not.toBeNull();

    const modelB = Array.from(submenu?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('model-b'));
    act(() => modelB?.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(props.onModelChange).toHaveBeenCalledWith('model-b');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers only Off, High, and Max and maps Off to undefined', () => {
    const props = renderSelector({ reasoningEffort: 'high' });
    const effortRow = container.querySelector('[aria-label="选择推理强度"]');

    act(() => effortRow?.dispatchEvent(new window.Event('mouseover', { bubbles: true })));

    const submenu = container.querySelector('[data-testid="effort-submenu"]');
    const options = Array.from(submenu?.querySelectorAll('button') ?? []);
    expect(options.map((button) => button.textContent?.trim())).toEqual(['Off', 'High', 'Max']);
    expect(submenu?.querySelector('[data-selected="true"]')?.textContent).toContain('High');

    act(() => options[0]?.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(props.onReasoningEffortChange).toHaveBeenCalledWith(undefined);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
