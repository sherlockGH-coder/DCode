import { describe, expect, it } from 'vitest';
import { formatSlashCommandsForTitle, parseLeadingSlashCommand } from './slashCommands';

describe('slashCommands', () => {
  it('formats slash command markers in titles', () => {
    expect(formatSlashCommandsForTitle('/frontend-design optimize this')).toBe('$frontend-design optimize this');
    expect(formatSlashCommandsForTitle('Run /compact first, then continue')).toBe('Run $compact first, then continue');
  });

  it('does not treat file paths as slash commands', () => {
    expect(formatSlashCommandsForTitle('/Users/conan/Code')).toBe('/Users/conan/Code');
  });

  it('parses a leading slash command for user message display', () => {
    expect(parseLeadingSlashCommand('/frontend-design optimize this')).toEqual({
      name: 'frontend-design',
      rest: 'optimize this',
    });
    expect(parseLeadingSlashCommand('/Users/conan/Code')).toBeNull();
  });
});
