import defaultSystemPrompt from './prompts/system.md?raw';
import { settingsManager } from './settings';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { app } from 'electron';

const DEEPSEEK_MD_FILENAME = 'DEEPSEEK.md';
const LOCAL_DEEPSEEK_MD_FILENAME = 'DEEPSEEK.local.md';
const DEEPSEEK_RULES_DIRNAME = 'rules';
const PROJECT_DEEPSEEK_DIR = '.deepseek';
const PROJECT_ROOT_MARKERS = ['.git'];
const DEFAULT_DEEPSEEK_MD_MAX_BYTES = 32 * 1024;

export interface DeepseekMdSource {
  filePath: string;
  contents: string;
  scope: 'user' | 'project' | 'local';
}

interface ReadDeepseekSourceResult {
  contents: string;
  bytesRead: number;
}

interface LoadDeepseekMdOptions {
  userDir?: string;
  maxBytes?: number;
}

/** Final system prompt combining user override and the default .md; callers read it before each request. */
export function getEffectiveSystemPrompt(): string {
  const override = settingsManager.getSystemPromptOverride().trim();
  return override || defaultSystemPrompt;
}

/** User-level configuration directory: ~/.deepseek/. */
function getUserDeepseekDir(): string {
  return join(app.getPath('home'), '.deepseek');
}

function readDeepseekSource(filePath: string, maxBytes: number): ReadDeepseekSourceResult | null {
  try {
    const data = readFileSync(filePath, 'utf-8');
    const byteLength = Buffer.byteLength(data, 'utf-8');
    const isOversized = byteLength > maxBytes;
    const text = (isOversized ? data.slice(0, maxBytes) : data).trim();
    if (isOversized) {
      console.warn(`[prompts] ${filePath} exceeds ${maxBytes} bytes; truncating before injection`);
    }
    return text ? { contents: text, bytesRead: Math.min(byteLength, maxBytes) } : null;
  } catch (err) {
    console.warn(`[prompts] Failed to read DEEPSEEK.md: ${filePath}`, err);
    return null;
  }
}

/** Find DEEPSEEK.md in a directory, excluding .local. */
function findDeepseekMdInDir(dir: string): string | null {
  const candidate = join(dir, DEEPSEEK_MD_FILENAME);
  try {
    if (statSync(candidate).isFile()) return candidate;
  } catch {}
  return null;
}

/** Find .deepseek/DEEPSEEK.md in a directory. */
function findProjectDeepseekMd(dir: string): string | null {
  const candidate = join(dir, PROJECT_DEEPSEEK_DIR, DEEPSEEK_MD_FILENAME);
  try {
    if (statSync(candidate).isFile()) return candidate;
  } catch {}
  return null;
}

/** Scan .deepseek/rules/*.md in filename order. */
function findRulesInDir(dir: string): string[] {
  const rulesDir = join(dir, PROJECT_DEEPSEEK_DIR, DEEPSEEK_RULES_DIRNAME);
  try {
    return readdirSync(rulesDir)
      .filter((name: string) => name.endsWith('.md'))
      .sort()
      .map((name: string) => join(rulesDir, name));
  } catch {
    return [];
  }
}

function resolveExistingDirectory(input: string | null): string | null {
  if (!input) return null;
  try {
    const absolute = resolve(input);
    const stats = statSync(absolute);
    return stats.isDirectory() ? absolute : dirname(absolute);
  } catch {
    return null;
  }
}

function findProjectRoot(startDir: string): string {
  let cursor = startDir;
  while (true) {
    if (PROJECT_ROOT_MARKERS.some((marker) => existsSync(join(cursor, marker)))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) return startDir;
    cursor = parent;
  }
}

function directoriesFromRoot(root: string, leaf: string): string[] {
  const dirs: string[] = [];
  let cursor = leaf;
  while (true) {
    dirs.push(cursor);
    if (cursor === root) break;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return dirs.reverse();
}

function collectDeepseekSources(
  projectPath: string | null,
  options: Required<LoadDeepseekMdOptions>,
): DeepseekMdSource[] {
  const sources: DeepseekMdSource[] = [];
  let remainingBytes = options.maxBytes;

  const userFile = findDeepseekMdInDir(options.userDir);
  if (userFile) {
    const loaded = readDeepseekSource(userFile, remainingBytes);
    if (loaded) {
      sources.push({ filePath: userFile, contents: loaded.contents, scope: 'user' });
      remainingBytes = Math.max(0, remainingBytes - loaded.bytesRead);
    }
  }
  if (remainingBytes === 0) return sources;

  const projectDir = resolveExistingDirectory(projectPath);
  if (!projectDir) return sources;

  for (const dir of directoriesFromRoot(findProjectRoot(projectDir), projectDir)) {
    if (remainingBytes === 0) break;

    const rootMd = findDeepseekMdInDir(dir);
    if (rootMd) {
      const loaded = readDeepseekSource(rootMd, remainingBytes);
      if (loaded) {
        sources.push({ filePath: rootMd, contents: loaded.contents, scope: 'project' });
        remainingBytes = Math.max(0, remainingBytes - loaded.bytesRead);
      }
    }
    if (remainingBytes === 0) break;

    const projectMd = findProjectDeepseekMd(dir);
    if (projectMd) {
      const loaded = readDeepseekSource(projectMd, remainingBytes);
      if (loaded) {
        sources.push({ filePath: projectMd, contents: loaded.contents, scope: 'project' });
        remainingBytes = Math.max(0, remainingBytes - loaded.bytesRead);
      }
    }
    if (remainingBytes === 0) break;

    const rules = findRulesInDir(dir);
    for (const ruleFile of rules) {
      if (remainingBytes === 0) break;
      const loaded = readDeepseekSource(ruleFile, remainingBytes);
      if (loaded) {
        sources.push({ filePath: ruleFile, contents: loaded.contents, scope: 'project' });
        remainingBytes = Math.max(0, remainingBytes - loaded.bytesRead);
      }
    }
  }
  if (remainingBytes === 0) return sources;

  const projectRoot = findProjectRoot(projectDir);
  const localFile = join(projectRoot, LOCAL_DEEPSEEK_MD_FILENAME);
  try {
    if (statSync(localFile).isFile()) {
      const loaded = readDeepseekSource(localFile, remainingBytes);
      if (loaded) {
        sources.push({ filePath: localFile, contents: loaded.contents, scope: 'local' });
      }
    }
  } catch {}

  return sources;
}

/**
 * Load DEEPSEEK.md configuration from multiple levels.
 * Return structured sources, each containing filePath, contents, and scope.
 *
 * Load order:
 * 1. User level: ~/.deepseek/DEEPSEEK.md (private global instructions).
 * 2. Project level, one directory at a time from repository root to projectPath:
 *    - DEEPSEEK.md at the repository root;
 *    - .deepseek/DEEPSEEK.md;
 *    - .deepseek/rules/*.md in filename order.
 * 3. Local level: DEEPSEEK.local.md at the project root, not checked into the codebase.
 */
export function loadDeepseekMdSources(
  projectPath: string | null,
  options: LoadDeepseekMdOptions = {},
): DeepseekMdSource[] {
  const resolvedOptions: Required<LoadDeepseekMdOptions> = {
    userDir: options.userDir ?? getUserDeepseekDir(),
    maxBytes: options.maxBytes ?? DEFAULT_DEEPSEEK_MD_MAX_BYTES,
  };
  return collectDeepseekSources(projectPath, resolvedOptions);
}

/**
 * Backward compatibility: return one concatenated string for the legacy interface.
 */
export function loadDeepseekMd(
  projectPath: string | null,
  options: LoadDeepseekMdOptions = {},
): string {
  const sources = loadDeepseekMdSources(projectPath, options);
  return sources.map((s) => s.contents).join('\n\n');
}

export function formatDeepseekMdContext(projectPath: string | null, contents: string): string {
  const directory = projectPath ? resolve(projectPath) : getUserDeepseekDir();
  return `# DEEPSEEK.md instructions for ${directory}\n\n<INSTRUCTIONS>\n${contents}\n</INSTRUCTIONS>`;
}
