import type { BasicScope } from './common.types';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskScope = BasicScope;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  scope: TaskScope;
  projectPath: string | null;
  /** Tasks blocking this task; it cannot start until they are complete. */
  blockedBy: string[];
  /** Tasks blocked by this task; they can start after this task completes. */
  blocks: string[];
  /** Whether this is a background task. */
  isBackground: boolean;
  /** Associated conversation ID used when the background task runs. */
  conversationId: string | null;
  /** Background-task output file path. */
  outputFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Create-task input. */
export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  blockedBy?: string[];
  blocks?: string[];
  isBackground?: boolean;
}

/** Batch create-task input. */
export interface TaskBatchInput {
  tasks: TaskInput[];
  /** Whether to replace existing tasks; false by default, meaning append mode. */
  replace?: boolean;
}

/** Update-task input. */
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  addBlockedBy?: string[];
  removeBlockedBy?: string[];
  addBlocks?: string[];
  removeBlocks?: string[];
}
