import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolveBuiltinSkillsDir } from './manager';

describe('resolveBuiltinSkillsDir', () => {
  it('uses the repository resources directory in development', () => {
    expect(resolveBuiltinSkillsDir(
      false,
      '/workspace/dcode-app',
      '/Applications/DCode.app/Contents/Resources',
    )).toBe(join('/workspace/dcode-app', 'resources', 'skills'));
  });

  it('uses the unpacked extraResources directory when packaged', () => {
    expect(resolveBuiltinSkillsDir(
      true,
      '/Applications/DCode.app/Contents/Resources/app.asar',
      '/Applications/DCode.app/Contents/Resources',
    )).toBe(join('/Applications/DCode.app/Contents/Resources', 'skills'));
  });
});
