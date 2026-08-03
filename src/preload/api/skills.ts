import { ipcRenderer } from 'electron';
import type { SkillScope, SkillSummary, Skill } from '../../shared/types';
import { subscribe } from '../bridge';

export const skillsApi = {
  /** List skills from all three scopes, including enabled state. */
  skillsList: (projectPath: string | null): Promise<SkillSummary[]> => {
    return ipcRenderer.invoke('skills:list', projectPath);
  },

  /** Read one skill, including its body. */
  skillsRead: (name: string, projectPath: string | null): Promise<Skill | null> => {
    return ipcRenderer.invoke('skills:read', name, projectPath);
  },

  /** Write a user-level or project-level skill from structured fields; the main process builds the frontmatter. */
  skillsWrite: (
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('skills:write', scope, payload, projectPath);
  },

  /** Delete a user-level or project-level skill. */
  skillsDelete: (
    scope: 'user' | 'project',
    name: string,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('skills:delete', scope, name, projectPath);
  },

  /** Enable or disable a skill. */
  skillsToggle: (name: string, enabled: boolean): Promise<void> => {
    return ipcRenderer.invoke('skills:toggle', name, enabled);
  },

  /** Open the skill directory in the system file manager. */
  skillsOpenDir: (scope: SkillScope, projectPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('skills:openDir', scope, projectPath);
  },

  /** Update the skill-directory watcher, called when switching projects. */
  skillsWatchProject: (projectPath: string | null): Promise<void> => {
    return ipcRenderer.invoke('skills:watchProject', projectPath);
  },

  /** Subscribe to skill changes; fs.watch and toggle/write/delete all emit changes. */
  onSkillsChanged: (callback: () => void): (() => void) => {
    return subscribe('skills:changed', callback);
  },
};
