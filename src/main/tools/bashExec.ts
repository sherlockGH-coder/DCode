import { ToolExecutor, ToolExecuteResult } from './types';
import { exec, spawn, type ExecException } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectManager } from '../project';
import { approvalService } from '../approvalService';
import { settingsManager } from '../settings';
import { debugLog } from '../logger';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const BACKGROUND_OUTPUT_DIR = join(tmpdir(), 'deepseek-bash-background');

const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b/i,
  /\brm\s+(-[a-zA-Z]*r)\b.*\//,
  /\bmkfs\b/i,
  /\bdd\b.*\bof=\/dev\//i,
  /:\(\)\{.*:\|:.*\}/,
  /\bchmod\s+(-R\s+)?777\b/i,
  /\bchown\s+-R\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkill\s+-9\s+1\b/i,
  /\bkillall\b/i,
  /\bpkill\b/i,
];

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(Math.trunc(value), MAX_TIMEOUT_MS);
}

function shellPath(): string | undefined {
  if (process.platform === 'win32') return process.env.COMSPEC;
  if (existsSync('/bin/bash')) return '/bin/bash';
  return '/bin/sh';
}

function formatCommandOutput(stdout: string, stderr: string): string {
  const output = [];
  if (stdout) output.push(stdout);
  if (stderr) output.push(`[stderr]\n${stderr}`);
  return output.join('\n') || '命令执行成功（无输出）';
}

function exitCodeFromError(error: ExecException): number {
  if (typeof error.code === 'number') return error.code;
  if (error.signal) return -1;
  return 1;
}

function startBackgroundCommand(command: string, cwd: string | undefined, timeout: number, startTime: number): ToolExecuteResult {
  mkdirSync(BACKGROUND_OUTPUT_DIR, { recursive: true });
  const taskId = `bash_${randomUUID()}`;
  const outputPath = join(BACKGROUND_OUTPUT_DIR, `${taskId}.log`);
  const header = [
    `Command: ${command}`,
    `Cwd: ${cwd || process.cwd()}`,
    `Started: ${new Date(startTime).toISOString()}`,
    `Timeout: ${timeout}ms`,
    '',
    '--- output ---',
    '',
  ].join('\n');
  writeFileSync(outputPath, header, 'utf-8');

  const outputFd = openSync(outputPath, 'a');
  const shell = shellPath();
  const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];
  const child = spawn(shell ?? command, shell ? shellArgs : [], {
    cwd,
    env: process.env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', outputFd, outputFd],
  });
  closeSync(outputFd);

  const pid = child.pid;
  const killTimer = pid
    ? setTimeout(() => {
        try {
          process.kill(process.platform === 'win32' ? pid : -pid, 'SIGTERM');
          appendFileSync(outputPath, `\n--- timed out after ${timeout}ms ---\n`, 'utf-8');
        } catch {

        }
      }, timeout)
    : null;
  killTimer?.unref();

  child.once('exit', (code, signal) => {
    if (killTimer) clearTimeout(killTimer);
    appendFileSync(
      outputPath,
      `\n--- exited code=${code ?? 'null'} signal=${signal ?? 'null'} at ${new Date().toISOString()} ---\n`,
      'utf-8',
    );
  });
  child.unref();

  const content = [
    `Started background bash command.`,
    `task_id: ${taskId}`,
    `pid: ${pid ?? 'unknown'}`,
    `cwd: ${cwd || process.cwd()}`,
    `output_file: ${outputPath}`,
    `The command is running in the background; do not poll it unless the user explicitly asks for status.`,
  ].join('\n');

  return {
    content,
    metadata: {
      kind: 'exec',
      command,
      exitCode: 0,
      duration: Date.now() - startTime,
      outputLines: content.split('\n').length,
    },
  };
}

export const bashExecTool: ToolExecutor = {
  definition: {
    name: 'bash_exec',
    description:
      'Executes a bash command and returns output. The command starts in the conversation project directory by default; do not `cd` there before running project commands. Working directory persists, but shell state does not; environment loads from user profile. Never use for `cat`, `head`, `tail`, `sed`, `awk`, or `echo` — use Read, Edit, Write, or direct output instead. Before creating files/directories, verify parent with `ls`. Quote paths containing spaces; prefer absolute paths, avoid `cd`. Timeout default 2 min, max 10 min. Use `run_in_background` for long tasks (no polling). Run independent commands as parallel tool calls; chain dependent ones with `&&`; use `;` only when failures don’t matter; never separate commands with newlines. Git: never skip hooks without explicit request, prefer new commits and safe operations; use `/git-autocommit` skill. Avoid `sleep`; rely on background notifications. For `find -regex` alternation, put the longest pattern first.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute. Chain dependent commands with &&; run independent commands as parallel tool calls.',
        },
        description: {
          type: 'string',
          description:
            '用一句话描述这个命令做了什么。供审批时展示给用户，帮助用户快速判断是否放行。示例："列出当前目录文件"、"安装 npm 依赖"、"运行单元测试"。不要写"复杂"或"有风险"这类词——只描述行为本身',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes), maximum 600000 (10 minutes).',
          default: DEFAULT_TIMEOUT_MS,
          maximum: MAX_TIMEOUT_MS,
          minimum: 1,
        },
        run_in_background: {
          type: 'boolean',
          description: 'Run long-lived commands asynchronously and return immediately with pid and output_file. Do not use this for commands that need immediate output.',
          default: false,
        },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const command = args.command as string;
    const toolDescription = args.description as string | undefined;
    const timeout = normalizeTimeout(args.timeout);
    const runInBackground = args.run_in_background === true;
    const startTime = Date.now();

    if (typeof command !== 'string' || command.trim().length === 0) {
      throw new Error('bash_exec requires a non-empty command.');
    }

    if (ctx.signal?.aborted) {
      return {
        content: '[Aborted] 用户中止了执行',
        error: true,
        metadata: {
          kind: 'exec',
          command,
          exitCode: -1,
          duration: 0,
          outputLines: 1,
        },
      };
    }

    const cwd = projectManager.getCwdForProject(ctx.projectPath);

    const policy = settingsManager.getBashPolicy();

    if (ctx.approvalPolicy === 'auto-approve' && isDangerousCommand(command)) {
      debugLog('tool', '危险命令被拦截 | 字符数:', command.length);
      return {
        content: `[Blocked] 定时任务拦截了危险命令: ${command}\n如需执行此类操作，请手动在对话中运行。`,
        error: true,
        metadata: {
          kind: 'exec',
          command,
          exitCode: -1,
          duration: 0,
          outputLines: 1,
        },
      };
    }

    let allowed = false;
    let reason: string | undefined;

    if (ctx.approvalPolicy === 'auto-deny') {
      allowed = false;
      reason = '定时任务配置为自动拒绝终端命令。';
    } else if (ctx.approvalPolicy === 'auto-approve' || policy === 'full_access') {
      allowed = true;
      debugLog('tool', '跳过 bash 审批 | 字符数:', command.length);
    } else {
      const decision = await approvalService.request({
        toolCallId: ctx.toolCallId,
        kind: 'bash_exec',
        command,
        description: toolDescription,
        cwd,
        traceId: ctx.traceId,
        conversationId: ctx.conversationId,
        turnId: ctx.turnId,
        attemptNo: ctx.attemptNo,
        targetWebContentsId: ctx.approvalWebContentsId,
      });
      allowed = decision.allowed;
      reason = decision.reason;
    }

    if (!allowed) {
      const msg = reason || '用户拒绝执行';
      debugLog('tool', '命令被拒绝 | 字符数:', command.length, '|', msg);
      return {
        content: `[Denied by user] ${msg}\n命令: ${command}`,
        error: true,
        metadata: {
          kind: 'exec',
          command,
          exitCode: -1,
          duration: Date.now() - startTime,
          outputLines: 1,
        },
      };
    }

    if (runInBackground) {
      return startBackgroundCommand(command, cwd ?? undefined, timeout, startTime);
    }

    if (cwd) {
      debugLog('tool', '执行命令 | cwd:', cwd, '| 字符数:', command.length);
    } else {
      debugLog('tool', '执行命令（无项目，使用进程默认 cwd）| 字符数:', command.length);
    }

    return new Promise((resolve) => {
      const options: Record<string, unknown> = {
        timeout,
        shell: shellPath(),
        env: process.env,
        maxBuffer: MAX_OUTPUT_BYTES,
        detached: process.platform !== 'win32',
      };
      if (cwd) {
        options.cwd = cwd;
      }

      let aborted = false;
      const child = exec(command, options as any, (error, stdout, stderr) => {
        ctx.signal?.removeEventListener('abort', abortListener);
        const duration = Date.now() - startTime;
        const stdoutText = String(stdout ?? '');
        const stderrText = String(stderr ?? '');

        if (aborted) {
          const content = '[Aborted] 用户中止了执行';
          resolve({
            content,
            error: true,
            metadata: {
              kind: 'exec',
              command,
              exitCode: -1,
              duration,
              outputLines: 1,
            },
          });
          return;
        }

        if (error) {
          const content = `命令执行失败: ${error.message}\n${formatCommandOutput(stdoutText, stderrText)}`;
          resolve({
            content,
            error: true,
            metadata: {
              kind: 'exec',
              command,
              exitCode: exitCodeFromError(error),
              duration,
              outputLines: content.split('\n').length,
            },
          });
          return;
        }

        const content = formatCommandOutput(stdoutText, stderrText);
        const outputLines = content.split('\n').length;

        resolve({
          content,
          metadata: { kind: 'exec', command, exitCode: 0, duration, outputLines },
        });
      });

      const abortListener = () => {
        aborted = true;
        const pid = child.pid;
        try {
          if (pid && process.platform !== 'win32') process.kill(-pid, 'SIGTERM');
          else child.kill('SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      };
      ctx.signal?.addEventListener('abort', abortListener, { once: true });
    });
  },
};
