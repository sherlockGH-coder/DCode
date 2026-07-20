import { describe, expect, it } from 'vitest';
import { formatSlashCommandsForTitle, parseLeadingSlashCommand } from './slashCommands';

describe('slashCommands', () => {
  it('formats slash command markers in titles', () => {
    expect(formatSlashCommandsForTitle('/frontend-design 优化一下')).toBe('$frontend-design 优化一下');
    expect(formatSlashCommandsForTitle('先 /compact 再继续')).toBe('先 $compact 再继续');
  });

  it('does not treat file paths as slash commands', () => {
    expect(formatSlashCommandsForTitle('/Users/conan/Code')).toBe('/Users/conan/Code');
  });

  it('parses a leading slash command for user message display', () => {
    expect(parseLeadingSlashCommand('/frontend-design 优化一下')).toEqual({
      name: 'frontend-design',
      rest: '优化一下',
    });
    expect(parseLeadingSlashCommand('/Users/conan/Code')).toBeNull();
  });
});
