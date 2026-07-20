import { describe, expect, it } from 'vitest';
import type { ToolItem } from '../../../shared/types';
import type { ToolSegment } from './types';
import { foldSegments } from './foldSegments';

describe('foldSegments', () => {
  it('bypasses outer collapsed-segment for single entry', () => {
    const segments: ToolSegment[] = [
      {
        index: 0,
        startMessageId: 'msg-1',
        isLastSegment: true,
        items: [
          {
            id: 'write_1',
            toolCallId: 'call_write',
            name: 'write_file',
            kind: 'write',
            status: 'done',
            timestamp: 0,
            path: '/tmp/test.txt',
          },
        ],
      },
    ];

    const result = foldSegments(segments, false);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('entry');
  });

  it('wraps multiple reads in collapsed-segment (reads are individual entries, no longer grouped)', () => {
    const segments: ToolSegment[] = [
      {
        index: 0,
        startMessageId: 'msg-1',
        isLastSegment: false,
        items: [
          {
            id: 'read_1',
            toolCallId: 'call_read_1',
            name: 'read_file',
            kind: 'read',
            status: 'done',
            timestamp: 0,
            path: '/tmp/test1.txt',
          },
          {
            id: 'read_2',
            toolCallId: 'call_read_2',
            name: 'read_file',
            kind: 'read',
            status: 'done',
            timestamp: 1,
            path: '/tmp/test2.txt',
          },
        ],
      },
    ];

    const result = foldSegments(segments, false);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('collapsed-segment');
    if (result[0].kind === 'collapsed-segment') {
      expect(result[0].units).toHaveLength(2);
      expect(result[0].units[0].kind).toBe('entry');
      expect(result[0].units[1].kind).toBe('entry');
    }
  });

  it('wraps multiple units in collapsed-segment', () => {
    const segments: ToolSegment[] = [
      {
        index: 0,
        startMessageId: 'msg-1',
        isLastSegment: false,
        items: [
          {
            id: 'read_1',
            toolCallId: 'call_read_1',
            name: 'read_file',
            kind: 'read',
            status: 'done',
            timestamp: 0,
            path: '/tmp/test1.txt',
          },
          {
            id: 'read_2',
            toolCallId: 'call_read_2',
            name: 'read_file',
            kind: 'read',
            status: 'done',
            timestamp: 1,
            path: '/tmp/test2.txt',
          },
          {
            id: 'write_1',
            toolCallId: 'call_write_1',
            name: 'write_file',
            kind: 'write',
            status: 'done',
            timestamp: 2,
            path: '/tmp/test3.txt',
          },
        ],
      },
    ];

    const result = foldSegments(segments, false);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('collapsed-segment');
    if (result[0].kind === 'collapsed-segment') {
      expect(result[0].units).toHaveLength(3);
      expect(result[0].units[0].kind).toBe('entry');
      expect(result[0].units[1].kind).toBe('entry');
      expect(result[0].units[2].kind).toBe('entry');
    }
  });

  it('keeps collapsed-segment children as non-container render units', () => {
    const segments: ToolSegment[] = [
      {
        index: 0,
        startMessageId: 'msg-1',
        isLastSegment: false,
        items: [
          {
            id: 'read_1',
            toolCallId: 'call_read_1',
            name: 'read_file',
            kind: 'read',
            status: 'done',
            timestamp: 0,
            path: '/tmp/test1.txt',
          },
          {
            id: 'grep_1',
            toolCallId: 'call_grep_1',
            name: 'grep',
            kind: 'grep',
            status: 'done',
            timestamp: 1,
            pattern: 'CollapsedSegment',
            matchCount: 2,
            fileCount: 1,
          },
          {
            id: 'glob_1',
            toolCallId: 'call_glob_1',
            name: 'glob',
            kind: 'glob',
            status: 'done',
            timestamp: 2,
            pattern: 'src/renderer/**/*.tsx',
            matchCount: 8,
          },
        ],
      },
    ];

    const result = foldSegments(segments, false);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('collapsed-segment');
    if (result[0].kind === 'collapsed-segment') {
      const childKinds = result[0].units.map((unit) => unit.kind);
      expect(childKinds).toEqual(['entry', 'exploration-group']);
      expect(childKinds).not.toContain('collapsed-segment');
      expect(childKinds).not.toContain('expanded-segment');
    }
  });
});
