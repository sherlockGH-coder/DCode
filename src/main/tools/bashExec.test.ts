import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { approvalService } from '../approvalService';
import { projectManager } from '../project';
import { settingsManager } from '../settings';
import { bashExecTool } from './bashExec';
import type { ToolExecutionContext } from './types';

vi.mock('../approvalService', () => ({
  approvalService: {
    request: vi.fn(),
  },
}));

vi.mock('../project', () => ({
  projectManager: {
    getCwdForProject: vi.fn(() => null),
  },
}));

vi.mock('../settings', () => ({
  settingsManager: {
    getBashPolicy: vi.fn(() => 'default'),
  },
}));

function context(policy: ToolExecutionContext['approvalPolicy'] = 'auto-approve'): ToolExecutionContext {
  return {
    projectPath: null,
    toolCallId: 'call_bash',
    approvalPolicy: policy,
  };
}

describe('bashExecTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectManager.getCwdForProject).mockReturnValue(null);
    vi.mocked(settingsManager.getBashPolicy).mockReturnValue('default');
  });

  it('uses the updated bash guidance and exposes run_in_background', () => {
    expect(bashExecTool.definition.description).toContain('Executes a bash command and returns output.');
    expect(bashExecTool.definition.description).toContain('starts in the conversation project directory');
    expect(bashExecTool.definition.description).toContain('do not `cd` there');
    expect(bashExecTool.definition.description).toContain('Use `run_in_background` for long tasks (no polling).');

    const schema = bashExecTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      additionalProperties?: boolean;
    };
    expect(schema.properties.timeout.default).toBe(120000);
    expect(schema.properties.timeout.maximum).toBe(600000);
    expect(schema.properties.run_in_background.type).toBe('boolean');
    expect(schema.additionalProperties).toBe(false);
  });

  it('executes a foreground command with auto-approve without requesting approval', async () => {
    const result = await bashExecTool.execute(
      { command: 'pwd' },
      context(),
    );

    expect(result.content.trim()).toBe(process.cwd());
    expect(result.metadata).toMatchObject({
      kind: 'exec',
      command: 'pwd',
      exitCode: 0,
    });
    expect(approvalService.request).not.toHaveBeenCalled();
  });

  it('executes foreground commands from the conversation project directory', async () => {
    vi.mocked(projectManager.getCwdForProject).mockReturnValue(process.cwd());

    const result = await bashExecTool.execute(
      { command: 'pwd' },
      { ...context(), projectPath: process.cwd() },
    );

    expect(result.content.trim()).toBe(process.cwd());
    expect(projectManager.getCwdForProject).toHaveBeenCalledWith(process.cwd());
    expect(approvalService.request).not.toHaveBeenCalled();
  });

  it('returns exec metadata when a command exits non-zero', async () => {
    const result = await bashExecTool.execute(
      { command: 'printf failure >&2; exit 7' },
      context(),
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain('failure');
    expect(result.metadata).toMatchObject({
      kind: 'exec',
      command: 'printf failure >&2; exit 7',
      exitCode: 7,
    });
  });

  it('starts background commands immediately and writes a log file', async () => {
    const result = await bashExecTool.execute(
      { command: 'printf bg-ok', run_in_background: true },
      context(),
    );

    expect(result.content).toContain('Started background bash command.');
    expect(result.content).toContain('do not poll');
    const outputFile = result.content.match(/^output_file: (.+)$/m)?.[1];
    expect(outputFile).toBeTruthy();
    expect(existsSync(outputFile!)).toBe(true);
    expect(readFileSync(outputFile!, 'utf-8')).toContain('Command: printf bg-ok');
    expect(result.metadata).toMatchObject({
      kind: 'exec',
      command: 'printf bg-ok',
      exitCode: 0,
    });
  });

  it('auto-denies bash when the execution context requires it', async () => {
    const result = await bashExecTool.execute(
      { command: 'pwd' },
      context('auto-deny'),
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain('[Denied by user]');
    expect(approvalService.request).not.toHaveBeenCalled();
  });

  it('blocks dangerous commands under auto-approve', async () => {
    const result = await bashExecTool.execute(
      { command: 'rm -rf /tmp/somewhere' },
      context(),
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain('[Blocked]');
    expect(approvalService.request).not.toHaveBeenCalled();
  });
});
