import { vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/fake/app/path',
    getPath: (_name: string) => '/fake/user/data',
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: (path: string, _encoding?: string) => {
      if (path.endsWith('.env')) return '';
      return actual.readFileSync(path, 'utf-8');
    },
    existsSync: (path: string) => {
      if (path.endsWith('.env')) return false;
      return actual.existsSync(path);
    },
  };
});
