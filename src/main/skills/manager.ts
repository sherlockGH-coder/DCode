import { app, BrowserWindow } from 'electron';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync,
  unlinkSync, watch as fsWatch, statSync,
} from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { settingsManager } from '../settings';
import { parseFrontmatter, stringifyFrontmatter } from './parser';
import type { Skill, SkillScope, SkillSummary } from '../../shared/types';
import { IPC_EVENTS } from '../../shared/types';
import { debugLog } from '../logger';

const SKILL_FILE_RE = /\.md$/i;
const NAME_SAFE_RE = /[^\w-]/g;
const BROADCAST_DEBOUNCE_MS = 200;

export function resolveBuiltinSkillsDir(
  isPackaged: boolean,
  appPath: string,
  resourcesPath: string,
): string {
  return isPackaged
    ? join(resourcesPath, 'skills')
    : join(appPath, 'resources', 'skills');
}

class SkillsManager {
  private watchers: FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private watcherKey: string | null = null;

  private builtinDir(): string {
    return resolveBuiltinSkillsDir(app.isPackaged, app.getAppPath(), process.resourcesPath);
  }
  private userDir(): string {
    return join(homedir(), '.agents', 'skills');
  }
  private projectDir(projectPath: string): string {
    return join(projectPath, '.agents', 'skills');
  }

  /** 给 IPC 用：把 scope + projectPath 解析为绝对目录（项目 + 没选项目时返回 null） */
  resolveDir(scope: SkillScope, projectPath: string | null): string | null {
    if (scope === 'builtin') return this.builtinDir();
    if (scope === 'user') return this.userDir();
    return projectPath ? this.projectDir(projectPath) : null;
  }

  private scanDir(dir: string, scope: SkillScope, disabled: string[]): SkillSummary[] {
    if (!existsSync(dir)) return [];
    const items: SkillSummary[] = [];
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      console.warn('[skills] 读取目录失败:', dir, err);
      return [];
    }

    for (const file of entries) {
      const entryPath = join(dir, file);
      let filePath: string;
      let skillName: string;

      if (SKILL_FILE_RE.test(file)) {

        filePath = entryPath;
        skillName = basename(file, '.md');
      } else {

        try {
          const st = statSync(entryPath);
          if (!st.isDirectory()) continue;
          const skillMd = join(entryPath, 'SKILL.md');
          if (!existsSync(skillMd)) continue;
          filePath = skillMd;
          skillName = file;
        } catch {
          continue;
        }
      }

      try {
        const raw = readFileSync(filePath, 'utf-8');
        const { frontmatter } = parseFrontmatter(raw);
        const name = String(frontmatter.name ?? skillName).trim();
        if (!name) continue;
        const description = String(frontmatter.description ?? '').trim();
        const at = frontmatter['allowed-tools'];
        const allowedTools = Array.isArray(at)
          ? (at as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
          : undefined;
        items.push({
          name,
          description,
          scope,
          filePath,
          allowedTools,
          enabled: !disabled.includes(name),
        });
      } catch (err) {
        console.warn('[skills] 解析失败:', filePath, err);
      }
    }
    return items;
  }

  scan(projectPath: string | null): SkillSummary[] {
    const disabled = settingsManager.getDisabledSkills();
    const map = new Map<string, SkillSummary>();
    for (const s of this.scanDir(this.builtinDir(), 'builtin', disabled)) map.set(s.name, s);
    for (const s of this.scanDir(this.userDir(), 'user', disabled)) map.set(s.name, s);
    if (projectPath) {
      for (const s of this.scanDir(this.projectDir(projectPath), 'project', disabled)) map.set(s.name, s);
    }
    return Array.from(map.values());
  }

  /** 仅启用的 skill — agentLoop 注入用 */
  getEnabled(projectPath: string | null): SkillSummary[] {
    return this.scan(projectPath).filter((s) => s.enabled);
  }

  read(name: string, projectPath: string | null): Skill | null {
    const summary = this.scan(projectPath).find((s) => s.name === name);
    if (!summary) return null;
    try {
      const raw = readFileSync(summary.filePath, 'utf-8');
      const { body } = parseFrontmatter(raw);
      return { ...summary, body };
    } catch (err) {
      console.warn('[skills] 读取正文失败:', summary.filePath, err);
      return null;
    }
  }

  write(
    scope: 'user' | 'project',
    name: string,
    content: string,
    projectPath: string | null,
  ): boolean {
    const dir = this.resolveDir(scope, projectPath);
    if (!dir) return false;
    const safeName = name.replace(NAME_SAFE_RE, '_').trim();
    if (!safeName) return false;
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${safeName}.md`), content, 'utf-8');
      this.scheduleBroadcast();
      return true;
    } catch (err) {
      console.error('[skills] 写入失败:', dir, name, err);
      return false;
    }
  }

  /** 给前端：name + description + allowedTools + body 直接拼 markdown 落盘 */
  writeStructured(
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
    projectPath: string | null,
  ): boolean {
    const fm: Record<string, unknown> = {
      name: payload.name,
      description: payload.description,
    };
    if (payload.allowedTools && payload.allowedTools.length > 0) {
      fm['allowed-tools'] = payload.allowedTools;
    }
    return this.write(scope, payload.name, stringifyFrontmatter(fm, payload.body), projectPath);
  }

  delete(scope: 'user' | 'project', name: string, projectPath: string | null): boolean {
    const dir = this.resolveDir(scope, projectPath);
    if (!dir) return false;
    const safeName = name.replace(NAME_SAFE_RE, '_').trim();
    if (!safeName) return false;
    const filePath = join(dir, `${safeName}.md`);
    if (!existsSync(filePath)) return false;
    try {
      unlinkSync(filePath);
      this.scheduleBroadcast();
      return true;
    } catch (err) {
      console.error('[skills] 删除失败:', filePath, err);
      return false;
    }
  }

  toggle(name: string, enabled: boolean): void {
    settingsManager.setSkillEnabled(name, enabled);
    this.scheduleBroadcast();
  }

  startWatchers(projectPath?: string | null): void {
    const watcherKey = projectPath ?? '';
    if (this.watcherKey === watcherKey) return;

    this.stopWatchers();
    this.watcherKey = watcherKey;
    const dirs = [this.builtinDir(), this.userDir()];
    if (projectPath) dirs.push(this.projectDir(projectPath as string));
    for (const dir of dirs) {
      try {
        if (!existsSync(dir)) {

          if (dir === this.userDir()) {
            try { mkdirSync(dir, { recursive: true }); } catch {              }
          } else {
            continue;
          }
        }
        const w = fsWatch(dir, { persistent: false }, () => this.scheduleBroadcast());
        this.watchers.push(w);
        debugLog('skills', 'watcher started:', dir);
      } catch (err) {
        console.warn('[skills] watch failed:', dir, err);
      }
    }
  }

  stopWatchers(): void {
    for (const w of this.watchers) {
      try { w.close(); } catch {              }
    }
    this.watchers = [];
    this.watcherKey = null;
  }

  scheduleBroadcast(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.broadcast(), BROADCAST_DEBOUNCE_MS);
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_EVENTS.SKILLS_CHANGED);
    }
  }
}

export const skillsManager = new SkillsManager();
