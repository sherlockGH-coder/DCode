import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import type { McpServerConfig } from '../../shared/types';

const PROJECT_DIR = '.dcode';
const PROJECT_FILE = 'mcp.json';

interface PersistedShape {
  mcpServers: Record<string, McpServerConfig>;
}

function userPath(): string {
  return resolve(homedir(), '.dcode.json');
}

function projectPath(projectRoot: string): string {
  return resolve(projectRoot, PROJECT_DIR, PROJECT_FILE);
}

function readFile(filePath: string): Record<string, McpServerConfig> {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return parsed.mcpServers ?? {};
  } catch (err) {
    console.warn('[mcp] 配置文件解析失败:', filePath, err);
    return {};
  }
}

function writeFile(filePath: string, map: Record<string, McpServerConfig>): void {
  try {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const shape: PersistedShape = { mcpServers: map };
    writeFileSync(filePath, JSON.stringify(shape, null, 2), 'utf-8');
  } catch (err) {
    console.error('[mcp] 配置写入失败:', filePath, err);
  }
}

export const mcpStore = {
  loadUser(): Record<string, McpServerConfig> {
    return readFile(userPath());
  },

  loadProject(projectRoot: string): Record<string, McpServerConfig> {
    return readFile(projectPath(projectRoot));
  },

  writeUser(map: Record<string, McpServerConfig>): void {
    writeFile(userPath(), map);
  },

  writeProject(projectRoot: string, map: Record<string, McpServerConfig>): void {
    writeFile(projectPath(projectRoot), map);
  },

  removeFile(scope: 'user' | 'project', projectRoot?: string): void {
    const filePath = scope === 'user' ? userPath() : (projectRoot ? projectPath(projectRoot) : null);
    if (filePath && existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {              }
    }
  },

  userPath,
  projectPath,
};
