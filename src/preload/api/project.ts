import { ipcRenderer } from 'electron';
import type { Project, ProjectCreateInput, ProjectState } from '../../shared/types';
import { subscribe } from '../bridge';

export const projectApi = {
  /** Get project state. */
  projectGetState: (): Promise<ProjectState> => {
    return ipcRenderer.invoke('project:getState');
  },

  /** Add a project; pass a path to add directly, or omit it to open the native dialog. */
  projectAdd: (folderPath?: string): Promise<Project | null> => {
    return ipcRenderer.invoke('project:add', folderPath);
  },

  /** Choose the parent directory for a new project. */
  projectPickParentDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('project:pickParentDirectory');
  },

  /** Create and register a project under the specified parent directory. */
  projectCreate: (input: ProjectCreateInput): Promise<Project> => {
    return ipcRenderer.invoke('project:create', input);
  },

  /** Remove a project. */
  projectRemove: (folderPath: string): Promise<boolean> => {
    return ipcRenderer.invoke('project:remove', folderPath);
  },

  /** Set the active project; pass null to clear the active state. */
  projectSetActive: (folderPath: string | null): Promise<boolean> => {
    return ipcRenderer.invoke('project:setActive', folderPath);
  },

  /** Subscribe to project state changes, emitted when projects are added, removed, or switched. */
  onProjectChanged: (callback: (state: ProjectState) => void) => {
    return subscribe('project:changed', callback);
  },
};
