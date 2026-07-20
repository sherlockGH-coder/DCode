import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { taskStore } from './store';
import { IPC_EVENTS } from '../../shared/types';
import type { Task, TaskInput, TaskUpdateInput, TaskStatus, TaskScope } from '../../shared/types';
import { findConversationIdByTaskId } from '../database';
import { debugLog } from '../logger';
import {
  FINISHED_STATUSES,
  applyTaskIdPatch,
  assertBatchCanBeCreated,
  assertScopeProjectPath,
  assertTaskCanBeCreated,
  assertTaskCanBeUpdated,
  normalizeTaskIds,
} from './validation';

export { TaskValidationError } from './validation';

const BROADCAST_DEBOUNCE_MS = 200;

export class TaskManager {
  private tasks = new Map<string, Task>();
  private currentProjectPath: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  async loadAll(activeProjectPath: string | null): Promise<void> {
    this.currentProjectPath = activeProjectPath;
    this.tasks.clear();

    const userTasks = taskStore.loadUser();
    for (const t of userTasks) {
      this.tasks.set(t.id, t);
    }

    if (activeProjectPath) {
      const projTasks = taskStore.loadProject(activeProjectPath);
      for (const t of projTasks) {
        this.tasks.set(t.id, t);
      }
    }

    this.repairNullConversationIds();
    this.scheduleBroadcast();
  }

  async refreshForProject(newProjectPath: string | null): Promise<void> {
    if (newProjectPath === this.currentProjectPath) return;

    for (const [id, t] of this.tasks) {
      if (t.scope === 'project' && t.projectPath === this.currentProjectPath) {
        this.tasks.delete(id);
      }
    }

    this.currentProjectPath = newProjectPath;

    if (newProjectPath) {
      const projTasks = taskStore.loadProject(newProjectPath);
      for (const t of projTasks) {
        this.tasks.set(t.id, t);
      }
    }

    this.repairNullConversationIds();
    this.scheduleBroadcast();
  }

  create(scope: TaskScope, input: TaskInput, projectPath: string | null, conversationId?: string | null): Task | null {
    assertScopeProjectPath(scope, projectPath);

    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title.trim() || 'Untitled',
      description: input.description?.trim() || '',
      status: input.status || 'pending',
      scope,
      projectPath,
      blockedBy: normalizeTaskIds(input.blockedBy),
      blocks: normalizeTaskIds(input.blocks),
      isBackground: input.isBackground || false,
      conversationId: conversationId || null,
      outputFilePath: null,
      createdAt: now,
      updatedAt: now,
      completedAt: FINISHED_STATUSES.has(input.status || 'pending') ? now : null,
    };
    assertTaskCanBeCreated(this.tasks, task);

    for (const blockerId of task.blockedBy) {
      const blocker = this.tasks.get(blockerId);
      if (blocker && !blocker.blocks.includes(task.id)) {
        blocker.blocks.push(task.id);
        blocker.updatedAt = now;
        this.persist(blocker);
      }
    }

    for (const blockedId of task.blocks) {
      const blocked = this.tasks.get(blockedId);
      if (blocked && !blocked.blockedBy.includes(task.id)) {
        blocked.blockedBy.push(task.id);
        blocked.updatedAt = now;
        this.persist(blocked);
      }
    }

    this.tasks.set(task.id, task);
    this.persist(task);
    this.scheduleBroadcast();
    return task;
  }

  createBatch(scope: TaskScope, inputs: TaskInput[], projectPath: string | null, conversationId?: string | null): Task[] {
    assertScopeProjectPath(scope, projectPath);
    const now = new Date().toISOString();

    const createdTasks = inputs.map((input): Task => {
      const status = input.status || 'pending';
      return {
        id: randomUUID(),
        title: input.title.trim() || 'Untitled',
        description: input.description?.trim() || '',
        status,
        scope,
        projectPath,
        blockedBy: normalizeTaskIds(input.blockedBy),
        blocks: normalizeTaskIds(input.blocks),
        isBackground: input.isBackground || false,
        conversationId: conversationId || null,
        outputFilePath: null,
        createdAt: now,
        updatedAt: now,
        completedAt: FINISHED_STATUSES.has(status) ? now : null,
      };
    });

    assertBatchCanBeCreated(this.tasks, createdTasks);

    for (const task of createdTasks) {
      this.tasks.set(task.id, task);
    }

    for (const task of createdTasks) {

      for (const blockerId of task.blockedBy) {
        const blocker = this.tasks.get(blockerId);
        if (blocker && !blocker.blocks.includes(task.id)) {
          blocker.blocks.push(task.id);
          blocker.updatedAt = now;
          this.persist(blocker);
        }
      }

      for (const blockedId of task.blocks) {
        const blocked = this.tasks.get(blockedId);
        if (blocked && !blocked.blockedBy.includes(task.id)) {
          blocked.blockedBy.push(task.id);
          blocked.updatedAt = now;
          this.persist(blocked);
        }
      }

      this.persist(task);
    }

    this.scheduleBroadcast();
    return createdTasks;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  list(status?: TaskStatus, scope?: TaskScope, conversationId?: string | null): Task[] {
    const all = Array.from(this.tasks.values());
    let filtered = all;
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (scope) {
      filtered = filtered.filter((t) => t.scope === scope);
    } else {

      filtered = filtered.filter((t) => {
        if (conversationId && t.conversationId === conversationId) return true;
        if (t.scope === 'user') return true;
        if (t.scope === 'project' && t.projectPath === this.currentProjectPath) return true;
        return false;
      });
    }

    const order: Record<TaskStatus, number> = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
    filtered.sort((a, b) => {
      const s = (order[a.status] ?? 2) - (order[b.status] ?? 2);
      if (s !== 0) return s;
      return a.createdAt.localeCompare(b.createdAt);
    });
    return filtered;
  }

  update(id: string, input: TaskUpdateInput, projectPath: string | null): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    const now = new Date().toISOString();
    const oldStatus = task.status;
    const nextBlockedBy = applyTaskIdPatch(task.blockedBy, input.addBlockedBy, input.removeBlockedBy);
    const nextBlocks = applyTaskIdPatch(task.blocks, input.addBlocks, input.removeBlocks);
    const nextStatus = input.status ?? task.status;

    assertTaskCanBeUpdated(this.tasks, task, nextStatus, nextBlockedBy, nextBlocks);

    if (input.title !== undefined) task.title = input.title.trim() || task.title;
    if (input.description !== undefined) task.description = input.description.trim();
    if (input.status !== undefined) {
      task.status = input.status;
      if (input.status === 'completed' || input.status === 'cancelled') {
        task.completedAt = now;
      } else {
        task.completedAt = null;
      }
    }

    const addedBlockedBy = normalizeTaskIds(input.addBlockedBy);
    const removedBlockedBy = new Set(normalizeTaskIds(input.removeBlockedBy));
    const addedBlocks = normalizeTaskIds(input.addBlocks);
    const removedBlocks = new Set(normalizeTaskIds(input.removeBlocks));

    if (addedBlockedBy.length > 0) {
      for (const blockerId of addedBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId);
        }
        const blocker = this.tasks.get(blockerId);
        if (blocker && !blocker.blocks.includes(task.id)) {
          blocker.blocks.push(task.id);
          blocker.updatedAt = now;
          this.persist(blocker);
        }
      }
    }
    if (addedBlocks.length > 0) {
      for (const blockedId of addedBlocks) {
        if (!task.blocks.includes(blockedId)) {
          task.blocks.push(blockedId);
        }
        const blocked = this.tasks.get(blockedId);
        if (blocked && !blocked.blockedBy.includes(task.id)) {
          blocked.blockedBy.push(task.id);
          blocked.updatedAt = now;
          this.persist(blocked);
        }
      }
    }

    if (removedBlockedBy.size > 0) {
      task.blockedBy = task.blockedBy.filter((bid) => {
        if (removedBlockedBy.has(bid)) {
          const blocker = this.tasks.get(bid);
          if (blocker) {
            blocker.blocks = blocker.blocks.filter((b) => b !== task.id);
            blocker.updatedAt = now;
            this.persist(blocker);
          }
          return false;
        }
        return true;
      });
    }
    if (removedBlocks.size > 0) {
      task.blocks = task.blocks.filter((bid) => {
        if (removedBlocks.has(bid)) {
          const blocked = this.tasks.get(bid);
          if (blocked) {
            blocked.blockedBy = blocked.blockedBy.filter((b) => b !== task.id);
            blocked.updatedAt = now;
            this.persist(blocked);
          }
          return false;
        }
        return true;
      });
    }

    if (oldStatus !== 'completed' && task.status === 'completed') {
      for (const blockedId of task.blocks) {
        const blocked = this.tasks.get(blockedId);
        if (blocked && blocked.status === 'pending') {

          const allBlockersDone = blocked.blockedBy.every((bid) => {
            const b = this.tasks.get(bid);
            return b && (b.status === 'completed' || b.status === 'cancelled');
          });
          if (allBlockersDone) {

            debugLog('tasks', `任务 "${blocked.title}" 的所有阻塞已解除，可开始执行`);
          }
        }
      }
    }

    task.updatedAt = now;
    this.tasks.set(task.id, task);
    this.persist(task);
    this.scheduleBroadcast();
    return task;
  }

  remove(id: string, projectPath: string | null): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    for (const blockerId of task.blockedBy) {
      const blocker = this.tasks.get(blockerId);
      if (blocker) {
        blocker.blocks = blocker.blocks.filter((b) => b !== id);
        blocker.updatedAt = new Date().toISOString();
        this.persist(blocker);
      }
    }
    for (const blockedId of task.blocks) {
      const blocked = this.tasks.get(blockedId);
      if (blocked) {
        blocked.blockedBy = blocked.blockedBy.filter((b) => b !== id);
        blocked.updatedAt = new Date().toISOString();
        this.persist(blocked);
      }
    }

    this.tasks.delete(id);
    this.persistRemove(task.scope, id, task.projectPath);
    this.scheduleBroadcast();
    return true;
  }

  bindConversation(taskId: string, conversationId: string, outputFilePath: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.conversationId = conversationId;
    task.outputFilePath = outputFilePath;
    task.isBackground = true;
    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);
    this.persist(task);
    this.scheduleBroadcast();
    return true;
  }

  private persist(task: Task): void {

    const userStoredTasks = Array.from(this.tasks.values()).filter(
      (t) => t.scope === 'user' || (t.scope === 'project' && !t.projectPath)
    );
    taskStore.writeUser(userStoredTasks);
    if (task.scope === 'project' && task.projectPath) {
      taskStore.writeProject(task.projectPath, this.filterByScope('project', task.projectPath));
    }
  }

  private persistRemove(scope: TaskScope, id: string, projectPath: string | null): void {
    if (scope === 'user' || !projectPath) {
      const userStoredTasks = Array.from(this.tasks.values()).filter(
        (t) => t.id !== id && (t.scope === 'user' || (t.scope === 'project' && !t.projectPath))
      );
      taskStore.writeUser(userStoredTasks);
    }
    if (projectPath) {
      const tasks = this.filterByScope('project', projectPath).filter((t) => t.id !== id);
      taskStore.writeProject(projectPath, tasks);
    }
  }

  private filterByScope(scope: TaskScope, projectPath?: string | null): Task[] {
    const result: Task[] = [];
    for (const t of this.tasks.values()) {
      if (t.scope === scope) {
        if (scope === 'project' && projectPath !== undefined && t.projectPath !== projectPath) continue;
        result.push(t);
      }
    }
    return result;
  }

  private repairNullConversationIds(): void {
    let changedUser = false;
    let changedProjects = new Set<string>();

    for (const [id, t] of this.tasks) {
      if (t.conversationId === null) {
        try {
          const convId = findConversationIdByTaskId(t.id);
          if (convId) {
            console.log(`[tasks] Auto-repaired task "${t.title}" (ID: ${t.id}) conversationId to "${convId}"`);
            t.conversationId = convId;
            t.updatedAt = new Date().toISOString();
            if (t.scope === 'user' || !t.projectPath) {
              changedUser = true;
            } else if (t.projectPath) {
              changedProjects.add(t.projectPath);
            }
          }
        } catch (err) {
          console.warn(`[tasks] Failed to repair null conversationId for task ${t.id}:`, err);
        }
      }
    }

    if (changedUser) {
      const userStoredTasks = Array.from(this.tasks.values()).filter(
        (t) => t.scope === 'user' || (t.scope === 'project' && !t.projectPath)
      );
      taskStore.writeUser(userStoredTasks);
    }

    for (const projPath of changedProjects) {
      taskStore.writeProject(projPath, this.filterByScope('project', projPath));
    }
  }

  private scheduleBroadcast(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.broadcast(), BROADCAST_DEBOUNCE_MS);
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_EVENTS.TASK_CHANGED);
    }
  }
}

export const taskManager = new TaskManager();
