import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ToolRegistry, type ToolExecutor } from './types';
import type { ToolCall } from '../../shared/types';

function executor(name: string): ToolExecutor {
  return {
    definition: {
      name,
      description: `${name} test tool`,
      input_schema: { type: 'object', properties: {} },
    },
    isReadonly: true,
    async execute() {
      return { content: `${name} executed` };
    },
  };
}

function toolCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: `call_${name}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

function registry(): ToolRegistry {
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(executor('read_file'));
  toolRegistry.register(executor('grep'));
  toolRegistry.register(executor('glob'));
  toolRegistry.register(executor('write_file'));
  toolRegistry.register(executor('edit_file'));
  return toolRegistry;
}

describe('ToolRegistry file permission policy', () => {
  it('lets local readonly tools run without approval when their path is inside the project', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    try {
      const result = await registry().execute(
        toolCall('read_file', { file_path: join(projectRoot, 'notes.md') }),
        { projectPath: projectRoot, approvalPolicy: 'auto-deny' },
      );

      expect(result.error).toBeUndefined();
      expect(result.content).toBe('read_file executed');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('requires approval for read_file outside the project', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    const outsideRoot = mkdtempSync(join(tmpdir(), 'deepseek-outside-'));
    try {
      const result = await registry().execute(
        toolCall('read_file', { file_path: join(outsideRoot, 'secret.txt') }),
        { projectPath: projectRoot, approvalPolicy: 'auto-deny' },
      );

      expect(result.error).toBe(true);
      expect(result.content).toContain('[Auto-denied]');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('requires approval for grep and glob outside the project', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    const outsideRoot = mkdtempSync(join(tmpdir(), 'deepseek-outside-'));
    try {
      for (const name of ['grep', 'glob']) {
        const result = await registry().execute(
          toolCall(name, { pattern: '*.ts', path: outsideRoot }),
          { projectPath: projectRoot, approvalPolicy: 'auto-deny' },
        );

        expect(result.error).toBe(true);
        expect(result.content).toContain('[Auto-denied]');
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('requires approval for file access in an unscoped conversation', async () => {
    const result = await registry().execute(
      toolCall('read_file', { file_path: '/tmp/notes.md' }),
      { projectPath: null, approvalPolicy: 'auto-deny' },
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain('[Auto-denied]');
  });

  it('allows an explicitly attached file in an unscoped conversation', async () => {
    const filePath = '/tmp/attached-notes.md';
    const result = await registry().execute(
      toolCall('read_file', { file_path: filePath }),
      {
        projectPath: null,
        approvalPolicy: 'auto-deny',
        attachmentWhitelist: new Map([[filePath, {
          id: 'attachment-1',
          path: filePath,
          name: 'attached-notes.md',
          mimeType: 'text/markdown',
          size: 10,
          kind: 'file',
        }]]),
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.content).toBe('read_file executed');
  });

  it('requires approval for edit_file outside the project using file_path', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    const outsideRoot = mkdtempSync(join(tmpdir(), 'deepseek-outside-'));
    try {
      const result = await registry().execute(
        toolCall('edit_file', {
          file_path: join(outsideRoot, 'secret.txt'),
          old_string: 'old',
          new_string: 'new',
        }),
        { projectPath: projectRoot, approvalPolicy: 'auto-deny' },
      );

      expect(result.error).toBe(true);
      expect(result.content).toContain('[Auto-denied]');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('requires approval for write_file outside the project using file_path', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    const outsideRoot = mkdtempSync(join(tmpdir(), 'deepseek-outside-'));
    try {
      const result = await registry().execute(
        toolCall('write_file', {
          file_path: join(outsideRoot, 'secret.txt'),
          content: 'secret',
        }),
        { projectPath: projectRoot, approvalPolicy: 'auto-deny' },
      );

      expect(result.error).toBe(true);
      expect(result.content).toContain('[Auto-denied]');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });
});
