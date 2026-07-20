import { ipcMain, shell } from 'electron';
import { skillsManager } from './manager';
import { toolRegistry } from '../tools';
import { loadSkillTool } from './loadSkillTool';
import { resolveKnownProjectPath } from '../projectScope';
import type { SkillScope } from '../../shared/types';

export { skillsManager } from './manager';

export function registerSkillsIpc(): void {

  toolRegistry.register(loadSkillTool);

  ipcMain.handle('skills:list', (_e, projectPath: string | null) => {
    return skillsManager.scan(resolveKnownProjectPath(projectPath));
  });

  ipcMain.handle('skills:read', (_e, name: string, projectPath: string | null) => {
    return skillsManager.read(name, resolveKnownProjectPath(projectPath));
  });

  ipcMain.handle(
    'skills:write',
    (
      _e,
      scope: 'user' | 'project',
      payload: { name: string; description: string; allowedTools?: string[]; body: string },
      projectPath: string | null,
    ) => {
      return skillsManager.writeStructured(scope, payload, resolveScopeProjectPath(scope, projectPath));
    },
  );

  ipcMain.handle(
    'skills:delete',
    (_e, scope: 'user' | 'project', name: string, projectPath: string | null) => {
      return skillsManager.delete(scope, name, resolveScopeProjectPath(scope, projectPath));
    },
  );

  ipcMain.handle('skills:toggle', (_e, name: string, enabled: boolean) => {
    skillsManager.toggle(name, enabled);
  });

  ipcMain.handle('skills:watchProject', (_e, projectPath: string | null) => {
    skillsManager.startWatchers(resolveKnownProjectPath(projectPath) ?? undefined);
  });

  ipcMain.handle(
    'skills:openDir',
    async (_e, scope: SkillScope, projectPath: string | null) => {
      const dir = skillsManager.resolveDir(scope, resolveSkillProjectPath(scope, projectPath));
      if (!dir) return false;
      try {
        await shell.openPath(dir);
        return true;
      } catch (err) {
        console.warn('[skills] openPath 失败:', dir, err);
        return false;
      }
    },
  );

  skillsManager.startWatchers();
}

function resolveScopeProjectPath(scope: 'user' | 'project', projectPath: string | null): string | null {
  return scope === 'project' ? resolveKnownProjectPath(projectPath) : null;
}

function resolveSkillProjectPath(scope: SkillScope, projectPath: string | null): string | null {
  return scope === 'project' ? resolveKnownProjectPath(projectPath) : null;
}
