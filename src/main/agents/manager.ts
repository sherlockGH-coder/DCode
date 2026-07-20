import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { agentLoop } from '../agentLoop';
import * as db from '../database';
import { IPC_EVENTS } from '../../shared/types';
import type { AgentLoopConfig, AgentRunStatus, AgentRunSummary, Message } from '../../shared/types';
import type { ToolRegistry } from '../tools/types';
import { mergeAbortSignals } from '../agent-loop/signals';

const DEFAULT_MAX_CONCURRENT_AGENTS = 4;
const DEFAULT_WAIT_TIMEOUT_MS = 60_000;
const MAX_WAIT_TIMEOUT_MS = 180_000;

export interface SubAgentRuntime extends AgentLoopConfig {
  toolRegistry: ToolRegistry;
}

export interface SpawnAgentInput {
  taskName: string;
  prompt: string;
  role?: string;
  contextSummary?: string;
}

interface AgentRunState {
  summary: AgentRunSummary;
  controller: AbortController;
  promise: Promise<void>;
}

interface SubAgentManagerOptions {
  maxConcurrent?: number;
  defaultWaitTimeoutMs?: number;
  maxWaitTimeoutMs?: number;
}

export class SubAgentManager {
  private readonly runs = new Map<string, AgentRunState>();
  private readonly maxConcurrent: number;
  private readonly defaultWaitTimeoutMs: number;
  private readonly maxWaitTimeoutMs: number;

  constructor(options: SubAgentManagerOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_AGENTS;
    this.defaultWaitTimeoutMs = options.defaultWaitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    this.maxWaitTimeoutMs = options.maxWaitTimeoutMs ?? MAX_WAIT_TIMEOUT_MS;
  }

  spawn(input: SpawnAgentInput, runtime: SubAgentRuntime): AgentRunSummary {
    const taskName = normalizeRequiredString(input.taskName, 'task_name');
    const prompt = normalizeRequiredString(input.prompt, 'prompt');
    this.assertRuntime(runtime);
    this.assertCanStartRun();

    const now = Date.now();
    const parentConversationId = runtime.conversationId ?? null;
    const parentConversation = parentConversationId ? db.getConversationById(parentConversationId) : undefined;
    const rootConversationId = parentConversation?.root_conversation_id ?? parentConversationId;
    const role = input.role?.trim() || 'explorer';
    const id = randomUUID();
    const conversationId = db.createConversation(
      `[Agent] ${taskName}`,
      runtime.projectPath ?? null,
      'agent',
      null,
      {
        parentConversationId,
        rootConversationId,
        agentRole: role,
        agentStatus: 'pending',
        agentTaskName: taskName,
      },
    );

    const userContent = buildAgentUserPrompt({ taskName, prompt, role, contextSummary: input.contextSummary });
    db.addMessage(conversationId, 'user', userContent);

    const summary: AgentRunSummary = {
      id,
      conversationId,
      parentConversationId,
      rootConversationId,
      taskName,
      role,
      prompt,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const controller = new AbortController();
    this.runs.set(id, { summary, controller, promise: Promise.resolve() });
    const promise = this.run(id, conversationId, runtime, controller);
    this.runs.set(id, {
      summary: this.runs.get(id)?.summary ?? summary,
      controller,
      promise,
    });
    this.broadcastChanged();
    return this.runs.get(id)?.summary ?? summary;
  }

  async wait(agentId: string, timeoutMs?: number, signal?: AbortSignal): Promise<{ summary: AgentRunSummary; timedOut: boolean }> {
    const state = this.runs.get(agentId);
    if (!state) {
      return {
        summary: notFoundSummary(agentId),
        timedOut: false,
      };
    }

    if (!isActiveStatus(state.summary.status)) {
      return { summary: state.summary, timedOut: false };
    }

    const timeout = clampWaitTimeout(timeoutMs, this.defaultWaitTimeoutMs, this.maxWaitTimeoutMs);
    const timedOut = await waitForPromiseOrTimeout(state.promise, timeout, signal);
    return {
      summary: this.runs.get(agentId)?.summary ?? state.summary,
      timedOut,
    };
  }

  sendInput(agentId: string, input: string, runtime: SubAgentRuntime): AgentRunSummary {
    const state = this.runs.get(agentId);
    if (!state) return notFoundSummary(agentId);
    if (state.summary.status === 'closed') {
      throw new Error('send_agent_input cannot restart a closed agent.');
    }
    if (isActiveStatus(state.summary.status)) {
      throw new Error('send_agent_input cannot interrupt a running agent. Call wait_agent first, then send follow-up input.');
    }
    this.assertRuntime(runtime);
    this.assertCanStartRun();

    const content = normalizeRequiredString(input, 'input');
    db.addMessage(state.summary.conversationId, 'user', content);
    const controller = new AbortController();
    const nextState: AgentRunState = {
      summary: {
        ...state.summary,
        status: 'pending',
        updatedAt: Date.now(),
        result: undefined,
        error: undefined,
      },
      controller,
      promise: Promise.resolve(),
    };
    this.runs.set(agentId, nextState);
    db.updateAgentConversationStatus(state.summary.conversationId, 'pending');
    const promise = this.run(agentId, state.summary.conversationId, runtime, controller);
    this.runs.set(agentId, {
      summary: this.runs.get(agentId)?.summary ?? nextState.summary,
      controller,
      promise,
    });
    this.broadcastChanged();
    return this.runs.get(agentId)?.summary ?? nextState.summary;
  }

  list(): AgentRunSummary[] {
    return Array.from(this.runs.values())
      .map((state) => state.summary)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  close(agentId: string): AgentRunSummary {
    const state = this.runs.get(agentId);
    if (!state) return notFoundSummary(agentId);

    state.controller.abort();
    const nextSummary = {
      ...state.summary,
      status: 'closed' as AgentRunStatus,
      updatedAt: Date.now(),
    };
    this.runs.set(agentId, { ...state, summary: nextSummary });
    db.updateAgentConversationStatus(nextSummary.conversationId, 'closed');
    this.broadcastChanged();
    return nextSummary;
  }

  private async run(
    agentId: string,
    conversationId: string,
    runtime: SubAgentRuntime,
    controller: AbortController,
  ): Promise<void> {
    this.update(agentId, { status: 'running' });
    db.updateAgentConversationStatus(conversationId, 'running');

    let seqCounter = 0;
    let terminalError: Error | null = null;
    let finalContent = '';
    const signal = mergeAbortSignals(runtime.signal, controller.signal);

    try {
      const messages = db.getMessages(conversationId) as Message[];
      finalContent = await agentLoop(
        messages,
        runtime.toolRegistry,
        {
          onChunk: () => {},
          onReasoningChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: () => {},
          onDone: (content) => {
            finalContent = content;
          },
          onError: (error) => {
            terminalError = error;
          },
          onAssistantMessage: (msg) => {
            db.addMessage(
              conversationId,
              'assistant',
              msg.content,
              msg.tool_calls,
              undefined,
              undefined,
              msg.reasoning_content,
              undefined,
              undefined,
              undefined,
              msg.usage,
              msg.duration,
              undefined,
              undefined,
              seqCounter++,
              msg.id,
            );
          },
          onToolMessage: (msg) => {
            db.addMessage(
              conversationId,
              'tool',
              msg.content,
              undefined,
              msg.tool_call_id,
              msg.metadata,
              undefined,
              undefined,
              msg.name,
              msg.error,
              undefined,
              undefined,
              undefined,
              undefined,
              seqCounter++,
              msg.id,
            );
          },
        },
        {
          ...runtime,
          conversationId,
          signal,
          toolAccessMode: 'subagent_readonly',
          subAgent: true,
          approvalPolicy: 'auto-deny',
          approvalWebContentsId: undefined,
        },
      );

      const current = this.runs.get(agentId)?.summary;
      if (!current || current.status === 'closed') return;

      if (controller.signal.aborted || runtime.signal?.aborted) {
        this.finish(agentId, 'cancelled', finalContent);
        return;
      }
      const capturedTerminalError = terminalError as Error | null;
      if (capturedTerminalError) {
        this.finish(agentId, 'errored', finalContent, capturedTerminalError.message);
        return;
      }
      this.finish(agentId, 'completed', finalContent);
    } catch (error) {
      const current = this.runs.get(agentId)?.summary;
      if (!current || current.status === 'closed') return;
      const message = error instanceof Error ? error.message : String(error);
      this.finish(agentId, controller.signal.aborted ? 'cancelled' : 'errored', finalContent, message);
    }
  }

  private finish(agentId: string, status: AgentRunStatus, result?: string, error?: string): void {
    const current = this.runs.get(agentId)?.summary;
    if (!current) return;
    this.update(agentId, { status, result, error });
    db.updateAgentConversationStatus(current.conversationId, status);
  }

  private update(
    agentId: string,
    patch: Partial<Pick<AgentRunSummary, 'status' | 'result' | 'error'>>,
  ): void {
    const current = this.runs.get(agentId);
    if (!current) return;

    const nextSummary: AgentRunSummary = {
      ...current.summary,
      ...patch,
      updatedAt: Date.now(),
    };
    this.runs.set(agentId, {
      ...current,
      summary: nextSummary,
    });
    this.broadcastChanged();
  }

  private assertRuntime(runtime: SubAgentRuntime): void {
    if (!runtime.apiKey) throw new Error('Cannot spawn sub-agent: missing API key in runtime.');
    if (!runtime.systemPrompt) throw new Error('Cannot spawn sub-agent: missing system prompt in runtime.');
    if (!runtime.toolRegistry) throw new Error('Cannot spawn sub-agent: missing tool registry in runtime.');
  }

  private assertCanStartRun(): void {
    const activeCount = Array.from(this.runs.values()).filter((state) => isActiveStatus(state.summary.status)).length;
    if (activeCount >= this.maxConcurrent) {
      throw new Error(`Sub-agent concurrency limit reached (${this.maxConcurrent}). Wait for an agent to finish before spawning another.`);
    }
  }

  private broadcastChanged(): void {
    const agents = this.list();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.webContents.isDestroyed()) {
        win.webContents.send(IPC_EVENTS.AGENTS_CHANGED, agents);
      }
    }
  }
}

function buildAgentUserPrompt(input: Required<Pick<SpawnAgentInput, 'taskName' | 'prompt' | 'role'>> & { contextSummary?: string }): string {
  const context = input.contextSummary?.trim();
  return [
    `You are a read-only sub-agent working on one delegated task.`,
    `Task: ${input.taskName}`,
    `Specialty: ${input.role}`,
    context ? `Context summary:\n${context}` : '',
    `Instructions:\n${input.prompt}`,
    [
      'Rules:',
      '- Work independently with the tools available to you.',
      '- Do not ask the user questions or delegate to another agent.',
      '- Do not mutate files, run shell commands, or change app state.',
      '- Keep the final answer concise and cite relevant files, functions, or commands inspected.',
      '- If evidence is incomplete, say what remains uncertain.',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function isActiveStatus(status: AgentRunStatus): boolean {
  return status === 'pending' || status === 'running';
}

function notFoundSummary(agentId: string): AgentRunSummary {
  const now = Date.now();
  return {
    id: agentId,
    conversationId: '',
    parentConversationId: null,
    rootConversationId: null,
    taskName: '',
    role: '',
    prompt: '',
    status: 'not_found',
    createdAt: now,
    updatedAt: now,
    error: `Agent not found: ${agentId}`,
  };
}

function clampWaitTimeout(value: number | undefined, defaultMs: number, maxMs: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return defaultMs;
  return Math.min(value, maxMs);
}

async function waitForPromiseOrTimeout(
  promise: Promise<void>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  try {
    return await Promise.race([
      promise.then(() => false),
      new Promise<boolean>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(true), timeoutMs);
      }),
      ...(signal ? [new Promise<boolean>((_resolve, reject) => {
        abortListener = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', abortListener, { once: true });
      })] : []),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (abortListener) signal?.removeEventListener('abort', abortListener);
  }
}

export const subAgentManager = new SubAgentManager();
