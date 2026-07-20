import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Project, ProjectCreateInput, ProjectState } from '../../shared/types';

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const applyState = useCallback((state: ProjectState) => {
    setProjects(state.projects);
    setActiveProject(state.activeProject);
  }, []);

  const loadState = useCallback(async () => {
    try {
      const state: ProjectState = await window.dcodeApi.projectGetState();
      applyState(state);
    } catch (err) {
      console.error('[useProject] 加载状态失败:', err);
    }
  }, [applyState]);

  const addProject = useCallback(async (folderPath?: string) => {
    try {
      const result = await window.dcodeApi.projectAdd(folderPath);
      if (result) await loadState();
      return result;
    } catch (err) {
      console.error('[useProject] 添加项目失败:', err);
      return null;
    }
  }, [loadState]);

  const pickProjectParentDirectory = useCallback(async () => {
    try {
      return await window.dcodeApi.projectPickParentDirectory();
    } catch (err) {
      console.error('[useProject] 选择项目位置失败:', err);
      return null;
    }
  }, []);

  const createProject = useCallback(async (input: ProjectCreateInput) => {
    try {
      const result = await window.dcodeApi.projectCreate(input);
      await loadState();
      return result;
    } catch (err) {
      console.error('[useProject] 创建项目失败:', err);
      throw err;
    }
  }, [loadState]);

  const removeProject = useCallback(async (folderPath: string) => {
    try {
      const ok = await window.dcodeApi.projectRemove(folderPath);
      if (ok) await loadState();
      return ok;
    } catch (err) {
      console.error('[useProject] 移除项目失败:', err);
      return false;
    }
  }, [loadState]);

  const selectProject = useCallback(async (folderPath: string | null) => {
    try {
      const ok = await window.dcodeApi.projectSetActive(folderPath);
      if (ok) await loadState();
      return ok;
    } catch (err) {
      console.error('[useProject] 设置激活项目失败:', err);
      return false;
    }
  }, [loadState]);

  useEffect(() => {
    loadState();
    const unsub = window.dcodeApi.onProjectChanged(applyState);
    return () => unsub();
  }, [loadState, applyState]);

  return useMemo(() => ({
    projects,
    activeProject,
    addProject,
    pickProjectParentDirectory,
    createProject,
    removeProject,
    selectProject,
    reload: loadState,
  }), [projects, activeProject, addProject, pickProjectParentDirectory, createProject, removeProject, selectProject, loadState]);
}
