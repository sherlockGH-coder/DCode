import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  clearLocalFilePreviewAllowListForTest,
  registerLocalFilePreviewPath,
  resolveLocalFileRequestPath,
} from './localFileProtocol';

const tempRoots: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  clearLocalFilePreviewAllowListForTest();
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('local-file protocol policy', () => {
  it('serves files inside known project roots', () => {
    const projectRoot = tempDir('deepseek-project-');
    const filePath = join(projectRoot, 'asset.png');
    writeFileSync(filePath, 'image');

    expect(resolveLocalFileRequestPath(`local-file://${filePath}`, [projectRoot])).toBe(filePath);
  });

  it('blocks unregistered files outside known project roots', () => {
    const projectRoot = tempDir('deepseek-project-');
    const outsideRoot = tempDir('deepseek-outside-');
    const filePath = join(outsideRoot, 'secret.txt');
    writeFileSync(filePath, 'secret');

    expect(resolveLocalFileRequestPath(`local-file://${filePath}`, [projectRoot])).toBeNull();
  });

  it('serves explicitly registered attachment paths outside the project', () => {
    const projectRoot = tempDir('deepseek-project-');
    const outsideRoot = tempDir('deepseek-outside-');
    const filePath = join(outsideRoot, 'photo.png');
    writeFileSync(filePath, 'image');

    registerLocalFilePreviewPath(filePath);

    expect(resolveLocalFileRequestPath(`local-file://${filePath}`, [projectRoot])).toBe(filePath);
  });

  it('blocks project-local symlinks that resolve outside the project', () => {
    const projectRoot = tempDir('deepseek-project-');
    const outsideRoot = tempDir('deepseek-outside-');
    const outsideFile = join(outsideRoot, 'secret.txt');
    const linkedFile = join(projectRoot, 'linked-secret.txt');
    writeFileSync(outsideFile, 'secret');
    symlinkSync(outsideFile, linkedFile);

    expect(resolveLocalFileRequestPath(`local-file://${linkedFile}`, [projectRoot])).toBeNull();
  });
});
