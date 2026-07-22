import { app } from 'electron';
import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Task } from '../../shared/types';

const USER_FILE = 'tasks.json';
const PROJECT_DIR = '.deepseek';
const PROJECT_FILE = 'tasks.json';

interface PersistedShape {
  schemaVersion: 1;
  tasks: Task[];
}

function userPath(): string {
  return resolve(app.getPath('userData'), USER_FILE);
}

function projectFilePath(projectRoot: string): string {
  return resolve(projectRoot, PROJECT_DIR, PROJECT_FILE);
}

function readFile(filePath: string): Task[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (!Array.isArray(parsed.tasks)) return [];
    return parsed.tasks.filter((t) => t && typeof t.id === 'string');
  } catch (err) {
    console.warn('[tasks] 配置文件解析失败:', filePath, err);
    return [];
  }
}

function writeFile(filePath: string, tasks: Task[]): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const shape: PersistedShape = { schemaVersion: 1, tasks };
    writeFileSync(filePath, JSON.stringify(shape, null, 2), 'utf-8');
  } catch (err) {
    console.error('[tasks] 配置写入失败:', filePath, err);
  }
}

export const taskStore = {
  loadUser(): Task[] {
    return readFile(userPath());
  },

  loadProject(projectRoot: string): Task[] {
    return readFile(projectFilePath(projectRoot));
  },

  writeUser(tasks: Task[]): void {
    writeFile(userPath(), tasks);
  },

  writeProject(projectRoot: string, tasks: Task[]): void {
    writeFile(projectFilePath(projectRoot), tasks);
  },

  userPath,
  projectFilePath,
};
