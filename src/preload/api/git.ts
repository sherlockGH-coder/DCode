import { ipcRenderer } from 'electron';
import type { ChangeUndoEntry, ChangeUndoResult, GitActionResult, GitCommitStatus } from '../../shared/types';

export const gitApi = {
  gitGetBranches: (folderPath: string): Promise<{ currentBranch: string; branches: string[] } | null> => {
    return ipcRenderer.invoke('git:getBranches', folderPath);
  },

  gitCheckoutBranch: (folderPath: string, branch: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('git:checkoutBranch', folderPath, branch);
  },

  /** Get changed files in a git repository (added, copied, modified, or renamed); non-git projects return { files:[], hasGit:false }. */
  gitGetChangedFiles: (folderPath: string): Promise<{ files: string[]; hasGit: boolean }> => {
    return ipcRenderer.invoke('git:getChangedFiles', folderPath);
  },

  /** Get a file's git unified diff; return an empty string on failure. */
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

  /** Undo file changes produced by one assistant turn. */
  undoChanges: (entries: ChangeUndoEntry[]): Promise<ChangeUndoResult> => {
    return ipcRenderer.invoke('changes:undo', entries);
  },
};
