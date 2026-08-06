/**
 * Render tests for the MCP plugins page (Variant A redesign):
 * status stats chips, scope grouping, per-server tool counts,
 * status labels, expand/copy interactions and the delete modal.
 */
import React, { act } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import type { McpServerStatus } from '../../../shared/types';
import PluginsPage from './PluginsPage';

const servers: McpServerStatus[] = [
  {
    name: 'ai-vision-mcp',
    scope: 'user',
    enabled: true,
    status: 'connected',
    config: { transport: 'stdio', command: 'npx', args: ['ai-vision-mcp'] },
    tools: [
      { name: 'analyze_image', namespacedName: 'mcp__ai-vision-mcp__analyze_image', description: 'Analyze an image' },
      { name: 'compare_images', namespacedName: 'mcp__ai-vision-mcp__compare_images', description: 'Compare images' },
      { name: 'detect_objects_in_image', namespacedName: 'mcp__ai-vision-mcp__detect_objects_in_image', description: 'Detect objects' },
      { name: 'analyze_video', namespacedName: 'mcp__ai-vision-mcp__analyze_video', description: 'Analyze video' },
    ],
  },
  {
    name: 'filesystem',
    scope: 'user',
    enabled: true,
    status: 'connected',
    config: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/conan/Code'] },
    tools: [
      { name: 'read_file', namespacedName: 'mcp__filesystem__read_file' },
      { name: 'write_file', namespacedName: 'mcp__filesystem__write_file' },
    ],
  },
  {
    name: 'playwright',
    scope: 'project',
    enabled: true,
    status: 'error',
    config: { transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
    tools: [{ name: 'browser_navigate', namespacedName: 'mcp__playwright__browser_navigate' }],
    lastError: 'spawn ENOENT — browser not installed',
  },
  {
    name: 'fetch',
    scope: 'project',
    enabled: false,
    status: 'stopped',
    config: { transport: 'stdio', command: 'uvx', args: ['mcp-server-fetch'] },
    tools: [{ name: 'fetch', namespacedName: 'mcp__fetch__fetch' }],
  },
];

describe('PluginsPage (Variant A redesign)', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(async () => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      configurable: true,
      writable: true,
    });
    Object.assign(window, {
      deepseekApi: {
        mcpListStatus: vi.fn().mockResolvedValue(servers),
        onMcpChanged: vi.fn(() => () => undefined),
        mcpAdd: vi.fn().mockResolvedValue(true),
        mcpUpdate: vi.fn().mockResolvedValue(true),
        mcpRemove: vi.fn().mockResolvedValue(true),
        mcpToggle: vi.fn().mockResolvedValue(true),
        mcpRestart: vi.fn().mockResolvedValue(true),
      },
    });
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  const render = async () => {
    await act(async () => {
      (root as Root).render(React.createElement(PluginsPage, { activeProject: '/tmp/proj' }));
      // Flush the async mcpListStatus result and the state update it triggers.
      await Promise.resolve();
    });
  };

  it('renders stats chips with real counts', async () => {
    await render();
    const text = container.textContent ?? '';
    // 2 running servers (ai-vision-mcp, filesystem), 7 enabled tools (4 + 2 + 1), 2 scopes
    expect(text).toContain('2');
    expect(text).toContain('running');
    expect(text).toContain('7');
    expect(text).toContain('tools');
    expect(text).toContain('scopes');
  });

  it('groups servers by scope with labels', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('user scope');
    expect(text).toContain('project scope');
    const userIdx = text.indexOf('user scope');
    const projectIdx = text.indexOf('project scope');
    expect(userIdx).toBeGreaterThan(-1);
    expect(projectIdx).toBeGreaterThan(userIdx);
  });

  it('shows per-server tool count chips', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('4 tools');
    expect(text).toContain('2 tools');
    expect(text).toContain('1 tools');
  });

  it('shows status labels for running, error and disabled servers', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('Running');
    expect(text).toContain('spawn ENOENT — browser not installed');
    expect(text).toContain('Disabled');
  });

  it('renders expand toggle and copy button in expanded command block', async () => {
    await render();
    // Expand the first card
    const expandButtons = Array.from(container.querySelectorAll('button[title="Expand"]'));
    expect(expandButtons.length).toBeGreaterThan(0);
    act(() => { (expandButtons[0] as HTMLElement).dispatchEvent(new window.Event('click', { bubbles: true })); });
    const text = container.textContent ?? '';
    expect(text).toContain('mcp__ai-vision-mcp__analyze_image');
    expect(container.querySelector('button[title="Copy command"]')).not.toBeNull();
  });

  it('copies tool namespaced name on pill click', async () => {
    await render();
    const expandButtons = Array.from(container.querySelectorAll('button[title="Expand"]'));
    act(() => { (expandButtons[0] as HTMLElement).dispatchEvent(new window.Event('click', { bubbles: true })); });
    const pill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('mcp__ai-vision-mcp__analyze_image'),
    ) as HTMLElement;
    expect(pill).toBeTruthy();
    act(() => { pill.dispatchEvent(new window.Event('click', { bubbles: true })); });
    await act(async () => {
      await Promise.resolve();
    });
    expect((globalThis.navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'mcp__ai-vision-mcp__analyze_image',
    );
  });

  it('renders delete confirmation modal copy unchanged', async () => {
    await render();
    const deleteButtons = Array.from(container.querySelectorAll('button[title="Delete"]'));
    act(() => { (deleteButtons[0] as HTMLElement).dispatchEvent(new window.Event('click', { bubbles: true })); });
    expect(container.textContent).toContain('Remove server');
    expect(container.textContent).toContain('Confirm removing');
  });
});
