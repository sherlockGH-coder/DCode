import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveInside } from './pathSandbox';

const tempRoots: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveInside', () => {
  it('resolves the deepest existing ancestor so nested missing paths cannot escape through symlinks', () => {
    const projectRoot = tempDir('dcode-project-');
    const outsideRoot = tempDir('dcode-outside-');
    mkdirSync(join(outsideRoot, 'nested'), { recursive: true });
    symlinkSync(join(outsideRoot, 'nested'), join(projectRoot, 'linked'), 'dir');

    const result = resolveInside('linked/missing/file.txt', projectRoot);

    expect(result.absolutePath).toBe(join(realpathSync.native(outsideRoot), 'nested', 'missing', 'file.txt'));
    expect(result.isInside).toBe(false);
    expect(result.symlinkResolved).toBe(true);
  });
});
