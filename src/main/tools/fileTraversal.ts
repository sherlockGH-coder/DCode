import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { IgnoreFilter } from './ignoreFilter';

export async function collectRelativeFilePaths(
  rootPath: string,
  ignore: IgnoreFilter,
): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.name === '.gitignore' && entry.isFile())) {
      const relativeDirectory = relative(rootPath, directory).replace(/\\/g, '/');
      try {
        ignore.addRules(relativeDirectory, await readFile(join(directory, '.gitignore'), 'utf-8'));
      } catch {
        // An unreadable ignore file must not make the search fail.
      }
    }

    for (const entry of entries) {
      if (ignore.isDefaultIgnoredDir(entry.name)) continue;

      const fullPath = join(directory, entry.name);
      const relativePath = relative(rootPath, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (!ignore.ignores(relativePath, true)) await walk(fullPath);
      } else if (entry.isFile() && !ignore.ignores(relativePath, false)) {
        files.push(relativePath);
      }
    }
  }

  await walk(rootPath);
  return files.sort();
}
