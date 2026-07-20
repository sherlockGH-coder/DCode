import { ipcRenderer } from 'electron';
import type { Project, ProjectCreateInput, ProjectState } from '../../shared/types';
import { subscribe } from '../bridge';

export const projectApi = {
  /** 获取项目状态 */
  projectGetState: (): Promise<ProjectState> => {
    return ipcRenderer.invoke('project:getState');
  },

  /** 添加项目（传路径直接添加，不传则弹出原生对话框） */
  projectAdd: (folderPath?: string): Promise<Project | null> => {
    return ipcRenderer.invoke('project:add', folderPath);
  },

  /** 选择新建项目的父目录 */
  projectPickParentDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('project:pickParentDirectory');
  },

  /** 在指定父目录下创建并注册项目 */
  projectCreate: (input: ProjectCreateInput): Promise<Project> => {
    return ipcRenderer.invoke('project:create', input);
  },

  /** 移除项目 */
  projectRemove: (folderPath: string): Promise<boolean> => {
    return ipcRenderer.invoke('project:remove', folderPath);
  },

  /** 设置激活项目（传 null 表示清空激活态） */
  projectSetActive: (folderPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('project:setActive', folderPath);
  },

  /** 订阅项目状态变化（添加/移除/切换激活时触发） */
  onProjectChanged: (callback: (state: ProjectState) => void) => {
    return subscribe('project:changed', callback);
  },
};
