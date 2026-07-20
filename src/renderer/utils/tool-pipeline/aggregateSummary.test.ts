import { describe, expect, it } from 'vitest';
import type { ToolItem } from '../../../shared/types';
import { aggregateSummary } from './aggregateSummary';

describe('aggregateSummary', () => {
  it('keeps terminal failure out of collapsed summary text', () => {
    const items: ToolItem[] = [
      {
        id: 'exec-call_1',
        toolCallId: 'call_exec',
        name: 'bash_exec',
        kind: 'exec',
        status: 'error',
        timestamp: 0,
        command: 'pnpm run dev',
        exitCode: 1,
        duration: 15700,
        outputLines: 20,
      },
    ];

    const summary = aggregateSummary(items);

    expect(summary).toContain('已运行 1 个命令');
    expect(summary).not.toContain('错误');
    expect(summary).not.toContain('失败');
  });

  it('formats file change summaries like codex file activity rows', () => {
    const items: ToolItem[] = [
      {
        id: 'edit-call_1',
        toolCallId: 'call_edit',
        name: 'edit_file',
        kind: 'edit',
        status: 'done',
        timestamp: 0,
        path: '/tmp/ToolItemCard.tsx',
        linesAdded: 4,
        linesDeleted: 2,
      },
    ];

    expect(aggregateSummary(items)).toBe('已编辑 1 个文件');
  });

  it('shows tool count for MCP and other uncategorized tools', () => {
    const items: ToolItem[] = [
      {
        id: 'tool-call_1',
        toolCallId: 'call_tool',
        name: 'mcp__ai-vision-mcp__analyze_image',
        kind: 'tool',
        status: 'done',
        timestamp: 0,
        toolName: 'mcp__ai-vision-mcp__analyze_image',
        input: '{}',
      },
      {
        id: 'tool-call_2',
        toolCallId: 'call_tool2',
        name: 'mcp__ai-vision-mcp__compare_images',
        kind: 'tool',
        status: 'done',
        timestamp: 0,
        toolName: 'mcp__ai-vision-mcp__compare_images',
        input: '{}',
      },
    ];

    expect(aggregateSummary(items)).toBe('已调用 2 个工具');
  });

  it('mixes regular tools with MCP tool calls', () => {
    const items: ToolItem[] = [
      {
        id: 'read-call_1',
        toolCallId: 'call_read',
        name: 'read_file',
        kind: 'read',
        status: 'done',
        timestamp: 0,
        path: '/tmp/foo.ts',
        lineCount: 10,
      },
      {
        id: 'tool-call_1',
        toolCallId: 'call_tool',
        name: 'mcp__ai-vision-mcp__analyze_image',
        kind: 'tool',
        status: 'done',
        timestamp: 0,
        toolName: 'mcp__ai-vision-mcp__analyze_image',
        input: '{}',
      },
    ];

    expect(aggregateSummary(items)).toBe('已读取 1 个文件， 已调用 1 个工具');
  });

  it('returns 已就绪 for empty items', () => {
    expect(aggregateSummary([])).toBe('已就绪');
  });
});
