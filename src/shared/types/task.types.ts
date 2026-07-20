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
  /** 被哪些任务阻塞（这些任务未完成前本任务不可开始） */
  blockedBy: string[];
  /** 阻塞了哪些任务（本任务完成后这些任务才能开始） */
  blocks: string[];
  /** 是否为后台任务 */
  isBackground: boolean;
  /** 关联的对话 ID（后台任务执行时的 conversation） */
  conversationId: string | null;
  /** 后台任务输出文件路径 */
  outputFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** 创建任务的输入参数 */
export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  blockedBy?: string[];
  blocks?: string[];
  isBackground?: boolean;
}

/** 批量创建任务的输入参数 */
export interface TaskBatchInput {
  tasks: TaskInput[];
  /** 是否替换现有任务（默认为 false，即追加模式） */
  replace?: boolean;
}

/** 更新任务的输入参数 */
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  addBlockedBy?: string[];
  removeBlockedBy?: string[];
  addBlocks?: string[];
  removeBlocks?: string[];
}
