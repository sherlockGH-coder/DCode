import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('preload entry', () => {
  it('does not require unsupported Node built-ins in the sandboxed preload', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

    expect(source).not.toMatch(/require\(['"](?:node:)?os['"]\)/);
    expect(source).not.toMatch(/from ['"](?:node:)?os['"]/);
  });

  it('uses asynchronous IPC for the home directory bridge', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

    expect(source).not.toContain('sendSync');
    expect(source).toContain("ipcRenderer.invoke('window:homeDir')");
  });
});
