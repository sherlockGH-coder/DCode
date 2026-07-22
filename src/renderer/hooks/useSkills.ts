import { useState, useEffect, useCallback } from 'react';
import type { Skill, SkillScope, SkillSummary } from '../../shared/types';

interface UseSkillsResult {
  skills: SkillSummary[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  toggle: (name: string, enabled: boolean) => Promise<void>;
  read: (name: string) => Promise<Skill | null>;
  write: (
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
  ) => Promise<boolean>;
  remove: (scope: 'user' | 'project', name: string) => Promise<boolean>;
  openDir: (scope: SkillScope) => Promise<boolean>;
}

/**
 * 监听三层 skill 列表 + 提供管理操作。
 * projectPath 变化时自动重 list。
 */
export function useSkills(projectPath: string | null): UseSkillsResult {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!window.deepseekApi?.skillsList) {
      setIsLoading(false);
      return;
    }
    try {
      const list = await window.deepseekApi.skillsList(projectPath);
      setSkills(list);
    } catch (err) {
      console.error('[useSkills] list failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    if (!window.deepseekApi?.onSkillsChanged) return undefined;
    const unsub = window.deepseekApi.onSkillsChanged(() => {
      refresh();
    });
    return unsub;
  }, [refresh]);

  const toggle = useCallback(async (name: string, enabled: boolean) => {
    await window.deepseekApi.skillsToggle(name, enabled);

  }, []);

  const read = useCallback(async (name: string) => {
    return window.deepseekApi.skillsRead(name, projectPath);
  }, [projectPath]);

  const write = useCallback(async (
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
  ) => {
    return window.deepseekApi.skillsWrite(scope, payload, projectPath);
  }, [projectPath]);

  const remove = useCallback(async (scope: 'user' | 'project', name: string) => {
    return window.deepseekApi.skillsDelete(scope, name, projectPath);
  }, [projectPath]);

  const openDir = useCallback(async (scope: SkillScope) => {
    return window.deepseekApi.skillsOpenDir(scope, projectPath);
  }, [projectPath]);

  return { skills, isLoading, refresh, toggle, read, write, remove, openDir };
}

export function useSkillsWatcher(projectPath: string | null): void {
  useEffect(() => {
    if (!window.deepseekApi?.skillsWatchProject) return;
    window.deepseekApi.skillsWatchProject(projectPath);
  }, [projectPath]);
}
