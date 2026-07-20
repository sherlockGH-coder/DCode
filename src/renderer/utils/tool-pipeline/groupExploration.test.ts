import { describe, expect, it } from 'vitest';
import type { ToolItem } from '../../../shared/types';
import { groupExploration } from './groupExploration';

describe('groupExploration', () => {
  it('groups grep and directory listing into exploration summary, keeps read as separate entry', () => {
    const items: ToolItem[] = [
      {
        id: 'read_1',
        toolCallId: 'call_read',
        name: 'read_file',
        kind: 'read',
        status: 'done',
        timestamp: 0,
        path: '/Users/conan/Code/10.project/DCode/src/renderer/components/preview/DiffView.tsx',
        lineCount: 520,
      },
      {
        id: 'grep_1',
        toolCallId: 'call_grep',
        name: 'grep',
        kind: 'grep',
        status: 'done',
        timestamp: 1,
        pattern: 'diff',
        matchCount: 12,
        fileCount: 4,
      },
      {
        id: 'list_1',
        toolCallId: 'call_list',
        name: 'list_directory',
        kind: 'list_directory',
        status: 'done',
        timestamp: 2,
        path: '/Users/conan/Code/10.project/DCode/src/renderer/components/preview',
        totalCount: 5,
      },
    ];

    const units = groupExploration(items, 0);

    expect(units).toHaveLength(2);

    expect(units[0].kind).toBe('entry');
    if (units[0].kind !== 'entry') return;
    expect(units[0].item.kind).toBe('read');

    expect(units[1].kind).toBe('exploration-group');
    if (units[1].kind !== 'exploration-group') return;
    expect(units[1].items).toHaveLength(2);
    expect(units[1].summary).toContain('已搜索');
    expect(units[1].summary).toContain('已列出文件');
  });
});
