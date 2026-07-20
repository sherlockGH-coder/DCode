import { ipcRenderer } from 'electron';
import type { SkillScope, SkillSummary, Skill } from '../../shared/types';
import { subscribe } from '../bridge';

export const skillsApi = {
  /** 列出三层 skill（含启用状态） */
  skillsList: (projectPath: string | null): Promise<SkillSummary[]> => {
    return ipcRenderer.invoke('skills:list', projectPath);
  },

  /** 读取单个 skill 含正文 */
  skillsRead: (name: string, projectPath: string | null): Promise<Skill | null> => {
    return ipcRenderer.invoke('skills:read', name, projectPath);
  },

  /** 写入用户级 / 项目级 skill（结构化字段，主进程拼 frontmatter） */
  skillsWrite: (
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('skills:write', scope, payload, projectPath);
  },

  /** 删除用户级 / 项目级 skill */
  skillsDelete: (
    scope: 'user' | 'project',
    name: string,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('skills:delete', scope, name, projectPath);
  },

  /** 启用 / 禁用 skill */
  skillsToggle: (name: string, enabled: boolean): Promise<void> => {
    return ipcRenderer.invoke('skills:toggle', name, enabled);
  },

  /** 在系统文件管理器中打开 skill 目录 */
  skillsOpenDir: (scope: SkillScope, projectPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('skills:openDir', scope, projectPath);
  },

  /** 更新 skill 目录监听（切换项目时调用） */
  skillsWatchProject: (projectPath: string | null): Promise<void> => {
    return ipcRenderer.invoke('skills:watchProject', projectPath);
  },

  /** 订阅 skill 变化（fs.watch + toggle / write / delete 都会触发） */
  onSkillsChanged: (callback: () => void): (() => void) => {
    return subscribe('skills:changed', callback);
  },
};
