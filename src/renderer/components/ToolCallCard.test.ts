import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ToolCallCard from './ToolCallCard';

describe('ToolCallCard', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
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

  it('renders active tool calls as codex-style inline activity rows', () => {
    act(() => {
      root?.render(React.createElement(ToolCallCard, {
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'update_plan',
              arguments: JSON.stringify({ explanation: '整理界面', plan: [{ step: '改工具行', status: 'in_progress' }] }),
            },
          },
        ],
      }));
    });

    const row = container.querySelector('[data-testid="tool-call-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(container.querySelector('[data-testid="tool-call-card"]')).toBeNull();
    expect(container.querySelector('[data-testid="tool-call-name"]')?.textContent).toContain('update_plan');
    expect(container.querySelector('[data-testid="tool-call-status"]')).toBeNull();
    expect(row?.textContent).not.toContain('执行中');
    expect(row?.textContent).toContain('explanation');
    expect(row?.outerHTML).toContain('min-h-6');
    expect(row?.outerHTML).toContain('bg-transparent');
    expect(row?.outerHTML).toContain('border-0');
    expect(row?.textContent).not.toContain('⚡');
  });

  it('renders the running tool call in the neutral activity color without shadows', () => {
    act(() => {
      root?.render(React.createElement(ToolCallCard, {
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'bash_exec',
              arguments: JSON.stringify({ command: 'pnpm test' }),
            },
          },
        ],
      }));
    });

    const row = container.querySelector('[data-testid="tool-call-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.outerHTML).not.toMatch(/(blue|emerald|amber|violet|rose|cyan|sky|indigo)-/);
    expect(row?.outerHTML).toContain('text-text-secondary');
    expect(row?.outerHTML).not.toContain('text-accent');
    expect(row?.outerHTML).not.toContain('shadow');
  });

  it('uses the MCP plug icon and frames expanded MCP arguments', () => {
    act(() => {
      root?.render(React.createElement(ToolCallCard, {
        toolCalls: [{
          id: 'call_mcp',
          type: 'function',
          function: { name: 'mcp__ai-vision-mcp__analyze_image', arguments: JSON.stringify({ imageSource: '/tmp/a.png' }) },
        }],
      }));
    });

    const row = container.querySelector('[data-testid="tool-call-row"]') as HTMLButtonElement;
    expect(container.querySelector('[data-tool-icon="mcp"]')).not.toBeNull();
    act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));

    const frame = container.querySelector('[data-testid="active-tool-detail-frame"]') as HTMLElement;
    expect(frame.className).toContain('border-hairline');
    expect(frame.className).toContain('rounded-[10px]');
    expect(frame.textContent).toContain('imageSource');
  });

  it('keeps active file-mutation arguments unframed', () => {
    act(() => {
      root?.render(React.createElement(ToolCallCard, {
        toolCalls: [{
          id: 'call_edit',
          type: 'function',
          function: { name: 'edit_file', arguments: JSON.stringify({ file_path: '/tmp/a.ts' }) },
        }],
      }));
    });

    const row = container.querySelector('[data-testid="tool-call-row"]') as HTMLButtonElement;
    act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(container.querySelector('[data-testid="active-tool-detail-frame"]')).toBeNull();
    expect(container.querySelector('[data-testid="active-file-change-detail"]')).not.toBeNull();
  });
});
