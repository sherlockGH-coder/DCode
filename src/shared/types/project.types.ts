/** Project environment type; only local is implemented, with worktree/remote/cloud reserved as placeholders. */
export type ProjectEnvironment = 'local';

/** Project entry. */
export interface Project {
  path: string;
  name: string;
  environment: ProjectEnvironment;
  addedAt: number;
}

/** New local-project input. */
export interface ProjectCreateInput {
  parentPath: string;
  name: string;
}

/** Overall project state. */
export interface ProjectState {
  projects: Project[];
  activeProject: string | null;
}

/** Git runtime environment and commit-panel state. */
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
