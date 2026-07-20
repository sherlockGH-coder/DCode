import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskManager, TaskValidationError } from './manager';

vi.mock('./store', () => ({
  taskStore: {
    loadUser: vi.fn(() => []),
    loadProject: vi.fn(() => []),
    writeUser: vi.fn(),
    writeProject: vi.fn(),
  },
}));

vi.mock('../database', () => ({
  findConversationIdByTaskId: vi.fn(() => null),
}));

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(async () => {
    manager = new TaskManager();
    await manager.loadAll('/workspace/project');
  });

  it('rejects project-scoped batch creation without a project path', () => {
    expect(() => {
      manager.createBatch('project', [{ title: 'Plan work' }], null);
    }).toThrow(TaskValidationError);
  });

  it('allows only one in-progress task at a time', () => {
    const first = manager.create('project', { title: 'First', status: 'in_progress' }, '/workspace/project');
    expect(first?.status).toBe('in_progress');

    expect(() => {
      manager.create('project', { title: 'Second', status: 'in_progress' }, '/workspace/project');
    }).toThrow('已有任务处于 in_progress 状态');
  });

  it('rejects invalid status transitions', () => {
    const task = manager.create('project', { title: 'Pending task' }, '/workspace/project');
    expect(task).not.toBeNull();

    expect(() => {
      manager.update(task!.id, { status: 'completed' }, '/workspace/project');
    }).toThrow('非法任务状态流转: pending -> completed');
  });

  it('rejects missing and self dependencies', () => {
    const task = manager.create('project', { title: 'Task' }, '/workspace/project');
    expect(task).not.toBeNull();

    expect(() => {
      manager.update(task!.id, { addBlockedBy: ['missing-task'] }, '/workspace/project');
    }).toThrow('依赖任务不存在: missing-task');

    expect(() => {
      manager.update(task!.id, { addBlocks: [task!.id] }, '/workspace/project');
    }).toThrow('任务不能依赖或阻塞自身');
  });

  it('rejects dependency cycles', () => {
    const first = manager.create('project', { title: 'First' }, '/workspace/project');
    const second = manager.create('project', { title: 'Second', blockedBy: [first!.id] }, '/workspace/project');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    expect(() => {
      manager.update(first!.id, { addBlockedBy: [second!.id] }, '/workspace/project');
    }).toThrow('依赖关系会形成循环');
  });

  it('rejects starting a task while blockers are unresolved', () => {
    const blocker = manager.create('project', { title: 'Blocker' }, '/workspace/project');
    const blocked = manager.create('project', { title: 'Blocked', blockedBy: [blocker!.id] }, '/workspace/project');
    expect(blocked).not.toBeNull();

    expect(() => {
      manager.update(blocked!.id, { status: 'in_progress' }, '/workspace/project');
    }).toThrow(`任务 ${blocked!.id} 仍被未完成任务阻塞: ${blocker!.id}`);
  });
});
