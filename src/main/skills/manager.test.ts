import { describe, expect, it } from 'vitest';
import { resolveBuiltinSkillsDir } from './manager';

describe('resolveBuiltinSkillsDir', () => {
  it('uses the repository resources directory in development', () => {
    expect(resolveBuiltinSkillsDir(
      false,
      '/workspace/deepseek-app',
      '/Applications/DeepSeek.app/Contents/Resources',
    )).toBe('/workspace/deepseek-app/resources/skills');
  });

  it('uses the unpacked extraResources directory when packaged', () => {
    expect(resolveBuiltinSkillsDir(
      true,
      '/Applications/DeepSeek.app/Contents/Resources/app.asar',
      '/Applications/DeepSeek.app/Contents/Resources',
    )).toBe('/Applications/DeepSeek.app/Contents/Resources/skills');
  });
});
