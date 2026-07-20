/** 项目环境类型；当前仅实现 local，预留 worktree/remote/cloud 占位 */
export type ProjectEnvironment = 'local';

/** 项目条目 */
export interface Project {
  path: string;
  name: string;
  environment: ProjectEnvironment;
  addedAt: number;
}

/** 新建本地项目输入 */
export interface ProjectCreateInput {
  parentPath: string;
  name: string;
}

/** 项目整体状态 */
export interface ProjectState {
  projects: Project[];
  activeProject: string | null;
}

/** Git 运行环境与提交面板状态。 */
export interface GitCommitStatus {
  hasGit: boolean;
  branch: string;
  additions: number;
  deletions: number;
  hasChanges: boolean;
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
  aheadCount: number;
  hasRemote: boolean;
  hasUpstream: boolean;
}

export interface GitActionResult {
  success: boolean;
  error?: string;
}
