import type { Task, TaskScope, TaskStatus } from '../../shared/types';

export const FINISHED_STATUSES = new Set<TaskStatus>(['completed', 'cancelled']);

const ALLOWED_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['in_progress'],
};

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

export function normalizeTaskIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    const normalized = typeof id === 'string' ? id.trim() : '';
    if (normalized) seen.add(normalized);
  }
  return Array.from(seen);
}

export function applyTaskIdPatch(currentIds: string[], addedIds?: string[], removedIds?: string[]): string[] {
  const removed = new Set(normalizeTaskIds(removedIds));
  return normalizeTaskIds([...currentIds, ...normalizeTaskIds(addedIds)]).filter((id) => !removed.has(id));
}

export function assertScopeProjectPath(scope: TaskScope, projectPath: string | null): void {
  if (scope === 'project' && !projectPath) {
    throw new TaskValidationError('project 作用域任务必须绑定有效项目路径');
  }
}

export function assertTaskCanBeCreated(tasks: Map<string, Task>, task: Task): void {
  assertReferencedTasksExist(tasks, task.id, task.blockedBy, task.blocks);
  assertBlockersResolved(tasks, task.id, task.status, task.blockedBy);
  assertNoCompetingInProgress(tasks, task.id, task.status);
  assertNoDependencyCycle(tasks, task.id, task.blockedBy, task.blocks);
}

export function assertBatchCanBeCreated(existingTasks: Map<string, Task>, tasks: Task[]): void {
  const batchIds = new Set(tasks.map((task) => task.id));
  const combinedTasks = new Map(existingTasks);
  for (const task of tasks) combinedTasks.set(task.id, task);

  for (const task of tasks) {
    assertReferencedTasksExist(combinedTasks, task.id, task.blockedBy, task.blocks, batchIds);
    assertBlockersResolved(existingTasks, task.id, task.status, task.blockedBy);
  }
  assertNoBatchDependencyCycle(existingTasks, tasks);

  const activeTasks = Array.from(existingTasks.values()).filter((task) => task.status === 'in_progress');
  const activeBatchTasks = tasks.filter((task) => task.status === 'in_progress');
  if (activeTasks.length + activeBatchTasks.length > 1) {
    throw new TaskValidationError('任意时刻只能有一个任务处于 in_progress 状态');
  }
}

export function assertTaskCanBeUpdated(
  tasks: Map<string, Task>,
  task: Task,
  nextStatus: TaskStatus,
  nextBlockedBy: string[],
  nextBlocks: string[],
): void {
  assertAllowedStatusTransition(task.status, nextStatus);
  assertReferencedTasksExist(tasks, task.id, nextBlockedBy, nextBlocks);
  assertBlockersResolved(tasks, task.id, nextStatus, nextBlockedBy);
  assertNoCompetingInProgress(tasks, task.id, nextStatus);
  assertNoDependencyCycle(tasks, task.id, nextBlockedBy, nextBlocks);
}

function assertAllowedStatusTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): void {
  if (currentStatus === nextStatus) return;
  if (ALLOWED_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) return;
  throw new TaskValidationError(`非法任务状态流转: ${currentStatus} -> ${nextStatus}`);
}

function assertReferencedTasksExist(
  tasks: Map<string, Task>,
  taskId: string,
  blockedBy: string[],
  blocks: string[],
  ignoredTaskIds = new Set<string>(),
): void {
  for (const relatedTaskId of [...blockedBy, ...blocks]) {
    if (relatedTaskId === taskId) {
      throw new TaskValidationError('任务不能依赖或阻塞自身');
    }
    if (!ignoredTaskIds.has(relatedTaskId) && !tasks.has(relatedTaskId)) {
      throw new TaskValidationError(`依赖任务不存在: ${relatedTaskId}`);
    }
  }
}

function assertBlockersResolved(tasks: Map<string, Task>, taskId: string, status: TaskStatus, blockedBy: string[]): void {
  if (status !== 'in_progress') return;
  const unresolved = blockedBy.filter((blockerId) => {
    const blocker = tasks.get(blockerId);
    return !blocker || !FINISHED_STATUSES.has(blocker.status);
  });
  if (unresolved.length > 0) {
    throw new TaskValidationError(`任务 ${taskId} 仍被未完成任务阻塞: ${unresolved.join(', ')}`);
  }
}

function assertNoCompetingInProgress(tasks: Map<string, Task>, taskId: string, status: TaskStatus): void {
  if (status !== 'in_progress') return;
  const activeTask = Array.from(tasks.values()).find((task) => {
    return task.id !== taskId && task.status === 'in_progress';
  });
  if (activeTask) {
    throw new TaskValidationError(`已有任务处于 in_progress 状态: ${activeTask.id}`);
  }
}

function assertNoDependencyCycle(tasks: Map<string, Task>, taskId: string, blockedBy: string[], blocks: string[]): void {
  const adjacency = buildDependencyGraphWithout(tasks, taskId);
  for (const blockerId of blockedBy) addEdge(adjacency, blockerId, taskId);
  for (const blockedId of blocks) addEdge(adjacency, taskId, blockedId);

  if (hasCycle(adjacency)) {
    throw new TaskValidationError('依赖关系会形成循环');
  }
}

function assertNoBatchDependencyCycle(existingTasks: Map<string, Task>, tasks: Task[]): void {
  const adjacency = buildDependencyGraphWithout(existingTasks, '');
  for (const task of tasks) {
    for (const blockedId of task.blocks) addEdge(adjacency, task.id, blockedId);
    for (const blockerId of task.blockedBy) addEdge(adjacency, blockerId, task.id);
  }

  if (hasCycle(adjacency)) {
    throw new TaskValidationError('依赖关系会形成循环');
  }
}

function buildDependencyGraphWithout(tasks: Map<string, Task>, excludedTaskId: string): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const task of tasks.values()) {
    if (task.id === excludedTaskId) continue;
    for (const blockedId of task.blocks) {
      if (blockedId !== excludedTaskId) addEdge(adjacency, task.id, blockedId);
    }
    for (const blockerId of task.blockedBy) {
      if (blockerId !== excludedTaskId) addEdge(adjacency, blockerId, task.id);
    }
  }
  return adjacency;
}

function addEdge(adjacency: Map<string, Set<string>>, from: string, to: string): void {
  const targets = adjacency.get(from) ?? new Set<string>();
  targets.add(to);
  adjacency.set(from, targets);
  if (!adjacency.has(to)) adjacency.set(to, new Set<string>());
}

function hasCycle(adjacency: Map<string, Set<string>>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): boolean => {
    if (visited.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of adjacency.keys()) {
    if (visit(node)) return true;
  }
  return false;
}
