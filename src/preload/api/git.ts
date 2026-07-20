import { ipcRenderer } from 'electron';
import type { ChangeUndoEntry, ChangeUndoResult, GitActionResult, GitCommitStatus } from '../../shared/types';

export const gitApi = {
  gitGetBranches: (folderPath: string): Promise<{ currentBranch: string; branches: string[] } | null> => {
    return ipcRenderer.invoke('git:getBranches', folderPath);
  },

  gitCheckoutBranch: (folderPath: string, branch: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('git:checkoutBranch', folderPath, branch);
  },

  /** 获取 git 仓库中已变更的文件列表（新增/复制/修改/重命名）；非 git 项目返回 { files:[], hasGit:false } */
  gitGetChangedFiles: (folderPath: string): Promise<{ files: string[]; hasGit: boolean }> => {
    return ipcRenderer.invoke('git:getChangedFiles', folderPath);
  },

  /** 获取单个文件的 git unified-diff；失败返回空字符串 */
  gitGetFileDiff: (folderPath: string, file: string): Promise<string> => {
    return ipcRenderer.invoke('git:getFileDiff', folderPath, file);
  },

  gitGetCommitStatus: (folderPath: string): Promise<GitCommitStatus> => {
    return ipcRenderer.invoke('git:getCommitStatus', folderPath);
  },

  gitCommit: (folderPath: string, message: string, includeUnstaged: boolean): Promise<GitActionResult> => {
    return ipcRenderer.invoke('git:commit', folderPath, message, includeUnstaged);
  },

  gitPush: (folderPath: string): Promise<GitActionResult> => {
    return ipcRenderer.invoke('git:push', folderPath);
  },

  /** 撤销一轮 assistant 产生的文件改动 */
  undoChanges: (entries: ChangeUndoEntry[]): Promise<ChangeUndoResult> => {
    return ipcRenderer.invoke('changes:undo', entries);
  },
};
