import { app, dialog } from 'electron';
import { resolve, sep } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import type { Project, ProjectCreateInput, ProjectState } from '../shared/types';
import { debugLog } from './logger';

const STATE_FILE = 'projects-state.json';
const LEGACY_STATE_FILE = 'workspace-state.json';
const INVALID_PROJECT_NAME_RE = /[\\/]|[\u0000-\u001f]/;

class ProjectManager {
  private projects: Project[] = [];
  private activeProject: string | null = null;

  private get statePath(): string {
    return resolve(app.getPath('userData'), STATE_FILE);
  }

  private get legacyStatePath(): string {
    return resolve(app.getPath('userData'), LEGACY_STATE_FILE);
  }

  load(): void {
    try {
      if (existsSync(this.statePath)) {
        const raw = readFileSync(this.statePath, 'utf-8');
        const state: ProjectState = JSON.parse(raw);
        this.projects = state.projects || [];
        this.activeProject = state.activeProject || null;
        return;
      }

      if (existsSync(this.legacyStatePath)) {
        console.log('[project] 检测到旧 workspace-state.json，开始迁移');
        const raw = readFileSync(this.legacyStatePath, 'utf-8');
        const legacy = JSON.parse(raw) as {
          folders?: Array<{ path: string; name: string; addedAt: number }>;
          activeFolder?: string | null;
        };
        this.projects = (legacy.folders ?? []).map((f) => ({
          path: f.path,
          name: f.name,
          environment: 'local',
          addedAt: f.addedAt,
        }));
        this.activeProject = legacy.activeFolder ?? null;
        this.save();
        try { renameSync(this.legacyStatePath, this.legacyStatePath + '.bak'); } catch {              }
        console.log('[project] 迁移完成，项目数:', this.projects.length);
        return;
      }
    } catch (err) {
      console.warn('[project] 加载状态失败，使用空状态:', err);
      this.projects = [];
      this.activeProject = null;
    }
  }

  private save(): void {
    const tmpPath = this.statePath + '.tmp';
    try {
      const state: ProjectState = {
        projects: this.projects,
        activeProject: this.activeProject,
      };
      writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      renameSync(tmpPath, this.statePath);
    } catch (err) {
      console.error('[project] 保存状态失败:', err);
      try { unlinkSync(tmpPath); } catch {              }
    }
  }

  async selectAndAddProject(): Promise<Project | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '添加已有项目文件夹',
      buttonLabel: '添加项目',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return this.addProject(result.filePaths[0]);
  }

  async selectProjectParentDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择新项目位置',
      buttonLabel: '选择位置',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return resolve(result.filePaths[0]);
  }

  async createProject(input: ProjectCreateInput): Promise<Project> {
    const parentPath = resolve(input.parentPath);
    const projectName = normalizeProjectName(input.name);
    const projectPath = resolve(parentPath, projectName);

    await assertDirectory(parentPath, '父目录不存在或不可访问');
    assertChildPath(parentPath, projectPath);

    if (existsSync(projectPath)) {
      throw new Error('目标文件夹已存在，请换一个项目名或使用“添加已有项目”。');
    }

    await mkdir(projectPath);
    const project = await this.addProject(projectPath);
    if (!project) {
      throw new Error('项目文件夹已创建，但注册项目失败。');
    }
    return project;
  }

  async addProject(folderPath: string): Promise<Project | null> {
    const resolvedPath = resolve(folderPath);

    try {
      const stats = await stat(resolvedPath);
      if (!stats.isDirectory()) {
        console.warn('[project] 路径不是文件夹:', resolvedPath);
        return null;
      }
    } catch {
      console.warn('[project] 路径无效:', resolvedPath);
      return null;
    }

    const existing = this.projects.find((p) => p.path === resolvedPath);
    if (existing) {
      this.activeProject = resolvedPath;
      this.save();
      return existing;
    }

    const project: Project = {
      path: resolvedPath,
      name: resolvedPath.split(sep).pop() || resolvedPath,
      environment: 'local',
      addedAt: Date.now(),
    };

    this.projects.push(project);
    if (this.projects.length === 1) this.activeProject = resolvedPath;

    this.save();
    debugLog('project', '添加项目:', project.path);
    return project;
  }

  removeProject(folderPath: string): boolean {
    const resolvedPath = resolve(folderPath);
    const idx = this.projects.findIndex((p) => p.path === resolvedPath);
    if (idx === -1) return false;

    this.projects.splice(idx, 1);
    if (this.activeProject === resolvedPath) {
      this.activeProject = this.projects.length > 0 ? this.projects[0].path : null;
    }

    this.save();
    debugLog('project', '移除项目:', resolvedPath);
    return true;
  }

  setActiveProject(folderPath: string | null): boolean {
    if (folderPath === null) {
      this.activeProject = null;
      this.save();
      return true;
    }
    const resolvedPath = resolve(folderPath);
    const exists = this.projects.find((p) => p.path === resolvedPath);
    if (!exists) return false;
    this.activeProject = resolvedPath;
    this.save();
    return true;
  }

  getCwdForProject(projectPath: string | null): string | null {
    if (!projectPath) return null;
    const resolvedPath = resolve(projectPath);
    const exists = this.projects.find((p) => p.path === resolvedPath);
    return exists ? resolvedPath : null;
  }

  getState(): ProjectState {
    return {
      projects: [...this.projects],
      activeProject: this.activeProject,
    };
  }

  hasProjects(): boolean {
    return this.projects.length > 0;
  }
}

export const projectManager = new ProjectManager();

function normalizeProjectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('项目名称不能为空。');
  }
  if (trimmed === '.' || trimmed === '..' || INVALID_PROJECT_NAME_RE.test(trimmed)) {
    throw new Error('项目名称不能包含路径分隔符、控制字符或特殊目录名。');
  }
  return trimmed;
}

async function assertDirectory(folderPath: string, message: string): Promise<void> {
  try {
    const stats = await stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}

function assertChildPath(parentPath: string, childPath: string): void {
  const normalizedParent = parentPath.endsWith(sep) ? parentPath : parentPath + sep;
  if (!childPath.startsWith(normalizedParent)) {
    throw new Error('新项目路径必须位于所选父目录内。');
  }
}
