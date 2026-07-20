import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolItem } from '../../shared/types';
import { initPathContext } from '../utils/collapsePath';
import ToolItemCard from './ToolItemCard';

const appContextMocks = vi.hoisted(() => ({
  setPreview: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({
  usePreviewActions: () => ({
    setPreview: appContextMocks.setPreview,
  }),
}));

describe('ToolItemCard', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: clipboardWriteText } },
      configurable: true,
    });
    initPathContext('/Users/conan/Code/10.project/DCode', '/Users/conan');
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

  it('renders completed file edits as a compact scannable tool row', () => {
    const item: ToolItem = {
      id: 'edit-call_1',
      toolCallId: 'call_1',
      name: 'edit_file',
      kind: 'edit',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/renderer/components/ToolItemCard.tsx',
      linesAdded: 4,
      linesDeleted: 2,
      diff: '@@ -1 +1 @@\n-old\n+new',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(container.querySelector('[data-testid="tool-item-kind-icon"]')?.getAttribute('data-tool-icon')).toBe('pencil');
    expect(container.querySelector('[data-testid="tool-item-status"]')).toBeNull();
    expect(row?.outerHTML).toContain('h-7');
    expect(row?.outerHTML).toContain('bg-transparent');
    expect(row?.outerHTML).toContain('border-0');
    expect(row?.textContent).toContain('已编辑');
    expect(row?.textContent).toContain('ToolItemCard.tsx');
    expect(row?.textContent).toContain('+4');
    expect(row?.textContent).toContain('-2');
    expect(row?.textContent).not.toContain('src/renderer/components/ToolItemCard.tsx');
  });

  it('keeps terminal status and duration out of the collapsed command row', () => {
    const item: ToolItem = {
      id: 'exec-call_1',
      toolCallId: 'call_exec',
      name: 'bash_exec',
      kind: 'exec',
      status: 'error',
      timestamp: 0,
      command: 'pnpm run dev',
      duration: 15700,
      exitCode: 1,
      outputLines: 20,
      output: '> electron-vite dev\n\nvite v6.4.2 building SSR bundle for development...\n✓ built in 244ms',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('已运行');
    expect(row?.textContent).toContain('pnpm run dev');
    expect(row?.textContent).not.toContain('15.7秒');
    expect(row?.textContent).toContain('失败');
    expect(row?.textContent).not.toContain('成功');
    expect(container.querySelector('[data-testid="tool-item-status"]')).toBeNull();
    expect(row?.outerHTML).not.toMatch(/(blue|emerald|amber|violet|rose|cyan|sky|indigo)-/);
    expect(row?.outerHTML).toContain('text-text-tertiary');
    expect(row?.outerHTML).not.toContain('rounded-lg');
    expect(row?.outerHTML).not.toContain('shadow');

    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const panel = container.querySelector('[data-testid="exec-output-panel"]') as HTMLElement | null;
    const detail = container.querySelector('[data-testid="tool-item-detail"]') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(detail?.className).toContain('ml-2');
    expect(detail?.className).not.toContain('ml-[25px]');
    expect(panel?.textContent).toContain('$ pnpm run dev');
    expect(panel?.textContent).toContain('electron-vite dev');
    expect(panel?.textContent).toContain('退出码 1');
  });

  it('does not show an inline status while a tool is executing', () => {
    const item: ToolItem = {
      id: 'exec-call_running',
      toolCallId: 'call_exec_running',
      name: 'bash_exec',
      kind: 'exec',
      status: 'running',
      timestamp: 0,
      command: 'pnpm run dev',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(container.querySelector('[data-testid="tool-item-status"]')).toBeNull();
    expect(row?.textContent).not.toContain('执行中');
  });

  it('frames only the expanded load_skill body', () => {
    const item: ToolItem = {
      id: 'skill-call_1',
      toolCallId: 'call_skill',
      name: 'load_skill',
      kind: 'tool',
      toolName: 'load_skill',
      input: JSON.stringify({ name: 'git-autocommit' }),
      output: '# Skill: git-autocommit\n\n自动分析 Git 工作区变更。',
      status: 'done',
      timestamp: 0,
    };

    act(() => root?.render(React.createElement(ToolItemCard, { item })));

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLButtonElement;
    expect(container.querySelector('[data-testid="skill-tool-output"]')).toBeNull();

    act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));

    const skillOutput = container.querySelector('[data-testid="skill-tool-output"]') as HTMLElement;
    expect(skillOutput).not.toBeNull();
    expect(skillOutput.className).toContain('bg-bg-block');
    expect(skillOutput.className).toContain('border-hairline');
    expect(skillOutput.className).toContain('rounded-[10px]');
    expect(row.className).toContain('bg-transparent');
  });

  it('frames expanded MCP and terminal details with the shared hairline container', () => {
    const items: ToolItem[] = [
      {
        id: 'mcp-call_1', toolCallId: 'call_mcp', name: 'mcp__vision__analyze_image', kind: 'tool',
        toolName: 'mcp__vision__analyze_image', input: '{}', output: 'image analyzed', status: 'done', timestamp: 0,
      },
      {
        id: 'exec-call_frame', toolCallId: 'call_exec_frame', name: 'bash_exec', kind: 'exec',
        command: 'pnpm test', output: '269 tests passed', exitCode: 0, status: 'done', timestamp: 0,
      },
    ];

    for (const item of items) {
      act(() => root?.render(React.createElement(ToolItemCard, { item, key: item.id })));
      const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLButtonElement;
      act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));
      const frame = container.querySelector('[data-testid="tool-detail-frame"]') as HTMLElement;
      expect(frame).not.toBeNull();
      expect(frame.className).toContain('border-hairline');
      expect(frame.className).toContain('rounded-[10px]');
    }
  });

  it('uses the MCP plug icon for completed MCP tool calls', () => {
    const item: ToolItem = {
      id: 'mcp-call_icon', toolCallId: 'call_mcp_icon', name: 'mcp__vision__analyze_image', kind: 'tool',
      toolName: 'mcp__vision__analyze_image', input: '{}', output: 'done', status: 'done', timestamp: 0,
    };

    act(() => root?.render(React.createElement(ToolItemCard, { item })));

    expect(container.querySelector('[data-testid="tool-item-kind-icon"]')?.getAttribute('data-tool-icon')).toBe('mcp');
  });

  it('frames expanded sub-agent details without changing the summary row', () => {
    const item: ToolItem = {
      id: 'agent-call_frame', toolCallId: 'call_agent_frame', name: 'spawn_agent', kind: 'agent',
      action: 'spawn', agentId: 'agent-1', taskName: '检查回归', output: '{"agent":{"id":"agent-1"}}',
      status: 'done', timestamp: 0,
    };

    act(() => root?.render(React.createElement(ToolItemCard, { item })));
    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLButtonElement;
    act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));

    const frame = container.querySelector('[data-testid="agent-tool-detail-frame"]') as HTMLElement;
    expect(frame.className).toContain('border-hairline');
    expect(frame.className).toContain('rounded-[10px]');
    expect(row.className).toContain('bg-transparent');
  });

  it('does not show awaiting approval status in the collapsed tool row', () => {
    const item: ToolItem = {
      id: 'exec-call_approval',
      toolCallId: 'call_exec_approval',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'cd /Users/conan/Code/Learn && ls -la',
      approvalDescription: '列出 Learn 目录内容',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;

    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('已运行');
    expect(row?.textContent).toContain('cd /Users/conan/Code/Learn && ls -la');
    expect(row?.textContent).not.toContain('待确认');
    expect(container.querySelector('[data-testid="tool-item-status"]')).toBeNull();
  });

  it('does not render a success footer for exitCode 0', () => {
    const item: ToolItem = {
      id: 'exec-call_success',
      toolCallId: 'call_exec_success',
      name: 'bash_exec',
      kind: 'exec',
      status: 'done',
      timestamp: 0,
      command: 'echo hello',
      duration: 100,
      exitCode: 0,
      outputLines: 1,
      output: 'hello',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const panel = container.querySelector('[data-testid="exec-output-panel"]') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.textContent).not.toContain('成功');
    expect(panel?.textContent).not.toContain('退出码 0');
  });

  it('unwraps login shell commands and copies the visible shell transcript', async () => {
    const item: ToolItem = {
      id: 'exec-call_2',
      toolCallId: 'call_exec_shell',
      name: 'bash_exec',
      kind: 'exec',
      status: 'error',
      timestamp: 0,
      command: '/bin/zsh -lc "pnpm test src/renderer/components/ToolItemCard.test.ts"',
      duration: 1200,
      exitCode: 1,
      outputLines: 6,
      output: 'FAIL src/renderer/components/ToolItemCard.test.ts\nExpected 1, received 0',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const panel = container.querySelector('[data-testid="exec-output-panel"]') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('$ pnpm test src/renderer/components/ToolItemCard.test.ts');
    expect(panel?.textContent).not.toContain('/bin/zsh -lc');

    const copyButton = panel?.querySelector('[data-testid="exec-output-copy"]') as HTMLElement | null;
    expect(copyButton).not.toBeNull();
    await act(async () => {
      copyButton?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(
      'FAIL src/renderer/components/ToolItemCard.test.ts\nExpected 1, received 0',
    );

    const cmdCopyBtn = panel?.querySelector('[data-testid="copy-command-btn"]') as HTMLElement | null;
    expect(cmdCopyBtn).not.toBeNull();
    await act(async () => {
      cmdCopyBtn?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(
      'pnpm test src/renderer/components/ToolItemCard.test.ts',
    );
  });

  it('renders read calls as gray basename-only rows without expandable file output', () => {
    const item: ToolItem = {
      id: 'read-call_1',
      toolCallId: 'call_read',
      name: 'read_file',
      kind: 'read',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/renderer/components/TerminalPanel.tsx',
      lineCount: 422,
      output: Array.from({ length: 80 }, (_, index) => `line ${index}`).join('\n'),
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('已读取');
    expect(row?.textContent).toContain('TerminalPanel.tsx');
    expect(row?.textContent).not.toContain('422 行');
    expect(row?.textContent).not.toContain('src/renderer/components/TerminalPanel.tsx');
    expect(row?.outerHTML).toContain('text-text-secondary');
    expect(row?.querySelector('.material-icon')).toBeNull();

    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('line 40');
    expect(container.querySelector('pre')).toBeNull();
  });

  it('renders compact same-color ellipsis and tighter command wrapping', () => {
    const item: ToolItem = {
      id: 'exec-call_long',
      toolCallId: 'call_exec_long',
      name: 'bash_exec',
      kind: 'exec',
      status: 'done',
      timestamp: 0,
      command: `curl -s -o /dev/null -w "HTTP Status: %{http_code}\\nTime: %{time_total}s\\n" "https://example.com/${'path/'.repeat(18)}"`,
      exitCode: 0,
      output: 'HTTP Status: 200',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const panel = container.querySelector('[data-testid="exec-output-panel"]') as HTMLElement | null;
    const ellipsis = panel?.querySelector('[data-testid="command-ellipsis"]') as HTMLElement | null;
    const copyButton = panel?.querySelector('[data-testid="copy-command-btn"]') as HTMLElement | null;
    expect(ellipsis?.className).toContain('tracking-[-0.16em]');
    expect(ellipsis?.className).toContain('text-current');
    expect(panel?.innerHTML).toContain('leading-[1.6]');
    expect(copyButton?.className).toContain('top-8');
  });

  it('shows spawn-agent timeout as a background-running status line', () => {
    const item: ToolItem = {
      id: 'agent-call_1',
      toolCallId: 'call_agent',
      name: 'spawn_agent',
      kind: 'agent',
      action: 'spawn',
      status: 'done',
      timestamp: 0,
      agentId: 'agent-1',
      taskName: '探索权限控制结构',
      agentStatus: 'running',
      timedOut: true,
      output: JSON.stringify({
        agent: {
          id: 'agent-1',
          conversationId: 'conv-agent-1',
          taskName: '探索权限控制结构',
          role: 'architecture-reader',
          status: 'running',
        },
        timedOut: true,
        result: 'Sub-agent is still running in background.',
      }, null, 2),
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    expect(container.textContent).toContain('后台运行中');

    const row = container.querySelector('button') as HTMLElement | null;
    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('agent_id');
    expect(container.textContent).toContain('agent-1');
    expect(container.textContent).toContain('稍后用 wait_agent');
    expect(container.textContent).toContain('Sub-agent is still running in background.');
    expect(container.textContent).not.toContain('"agent"');
    expect(container.textContent).not.toContain('"conversationId"');
  });

  it('renders list_agents output as compact agent rows instead of raw JSON', () => {
    const item: ToolItem = {
      id: 'agent-call_list',
      toolCallId: 'call_agent_list',
      name: 'list_agents',
      kind: 'agent',
      action: 'list',
      status: 'done',
      timestamp: 0,
      output: JSON.stringify({
        agents: [
          {
            id: 'agent-1',
            conversationId: 'conv-agent-1',
            taskName: '权限控制调研',
            role: 'code-reader',
            status: 'completed',
          },
          {
            id: 'agent-2',
            conversationId: 'conv-agent-2',
            taskName: '工具展示检查',
            role: 'ui-reader',
            status: 'running',
          },
        ],
      }, null, 2),
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    expect(container.textContent).toContain('子 Agent');
    expect(container.textContent).toContain('2 个子 Agent');

    const row = container.querySelector('button') as HTMLElement | null;
    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('权限控制调研');
    expect(container.textContent).toContain('工具展示检查');
    expect(container.textContent).not.toContain('"agents"');
    expect(container.textContent).not.toContain('"conversationId"');
  });

  it('expands file changes directly into diff details from the receipt row', () => {
    const item: ToolItem = {
      id: 'edit-call_2',
      toolCallId: 'call_2',
      name: 'edit_file',
      kind: 'edit',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/renderer/components/ToolItemCard.tsx',
      linesAdded: 4,
      linesDeleted: 2,
      diff: '@@ -1,2 +1,2 @@\n-old\n+new',
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row?.textContent).toContain('已编辑');
    expect(row?.textContent).toContain('ToolItemCard.tsx');
    expect(row?.textContent).toContain('+4');
    expect(row?.textContent).toContain('-2');
    expect(container.querySelector('[data-testid="file-change-detail"]')).toBeNull();

    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const detail = container.querySelector('[data-testid="file-change-detail"]') as HTMLElement | null;
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toContain('ToolItemCard.tsx');
    expect(detail?.textContent).toContain('+4');
    expect(detail?.textContent).toContain('-2');
    expect(detail?.textContent).toContain('old');
    expect(detail?.textContent).toContain('new');
  });

  it('renders file changes without diff text as a non-expandable receipt row', () => {
    const item: ToolItem = {
      id: 'write-call_1',
      toolCallId: 'call_write',
      name: 'write_file',
      kind: 'write',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/renderer/components/NewFile.tsx',
      isNew: true,
    };

    act(() => {
      root?.render(React.createElement(ToolItemCard, { item }));
    });

    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement | null;
    expect(row?.textContent).toContain('已创建');
    expect(row?.textContent).toContain('NewFile.tsx');
    expect(row?.textContent).toContain('+0');
    expect(row?.textContent).toContain('-0');

    act(() => {
      row?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="file-change-detail"]')).toBeNull();
  });

  it('expands ask-user questions with options, selected answers, and completion status', () => {
    const item: ToolItem = {
      id: 'ask-call_1',
      toolCallId: 'call_ask',
      name: 'ask_user_question',
      kind: 'ask_user_question',
      status: 'done',
      timestamp: 0,
      questions: [{
        question: 'Which implementation should be used?',
        header: 'Approach',
        options: [
          { label: 'Robust', description: 'Use the maintainable implementation.' },
          { label: 'Minimal', description: 'Make only the smallest change.' },
        ],
        multiSelect: false,
      }],
      answers: { 'Which implementation should be used?': 'Robust' },
      output: '用户已作答。',
    };

    act(() => root?.render(React.createElement(ToolItemCard, { item })));
    const row = container.querySelector('[data-testid="tool-item-row"]') as HTMLElement;
    expect(row.textContent).toContain('已提问');
    expect(container.querySelector('[data-testid="ask-user-question-detail"]')).toBeNull();

    act(() => row.dispatchEvent(new window.Event('click', { bubbles: true })));
    const detail = container.querySelector('[data-testid="ask-user-question-detail"]') as HTMLElement;
    expect(detail.textContent).toContain('Which implementation should be used?');
    expect(detail.textContent).toContain('Robust');
    expect(detail.textContent).toContain('Minimal');
    expect(detail.textContent).toContain('用户选择：Robust');
    expect(detail.textContent).toContain('已完成');
  });

});
