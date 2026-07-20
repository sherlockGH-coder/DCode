import type { ToolExecutor, ToolExecutionContext } from './types';
import { subAgentManager } from '../agents';
import type { AgentRunSummary, AgentToolMetadata } from '../../shared/types';

const DEFAULT_SPAWN_WAIT_TIMEOUT_MS = 180_000;

function requireRuntime(ctx: ToolExecutionContext) {
  if (!ctx.agentRuntime) {
    throw new Error('Agent runtime is unavailable for this tool call.');
  }
  return ctx.agentRuntime;
}

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalStringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumberArg(args: Record<string, unknown>, name: string): number | undefined {
  const value = args[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanArg(args: Record<string, unknown>, name: string, fallback: boolean): boolean {
  const value = args[name];
  return typeof value === 'boolean' ? value : fallback;
}

function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function agentResult(summary: AgentRunSummary, action: AgentToolMetadata['action'], extra: Partial<AgentToolMetadata> = {}) {
  const metadata: AgentToolMetadata = {
    kind: 'agent',
    action,
    agentId: summary.id,
    taskName: summary.taskName,
    role: summary.role,
    status: summary.status,
    prompt: summary.prompt,
    result: summary.result,
    ...extra,
  };
  return {
    content: jsonContent({ agent: summary, ...extra }),
    metadata,
    error: summary.status === 'errored' || summary.status === 'not_found',
  };
}

export const spawnAgentTool: ToolExecutor = {
  definition: {
    name: 'spawn_agent',
    description:
      'Delegate a focused read-only task to a sub-agent. Use for independent codebase research, cross-file analysis, or parallel investigation. Provide a short description and a precise prompt; the sub-agent receives only this task plus optional context_summary. It cannot ask the user, spawn agents, run shell commands, write files, or mutate state. Omit run_in_background for normal tasks; set it true for long-running work and use wait_agent later.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Short 3-7 word task label.' },
        prompt: { type: 'string', description: 'Detailed read-only task for the sub-agent to perform.' },
        subagent_type: { type: 'string', description: 'Optional specialty label, e.g. code-reviewer, test-scout, architecture-reader.' },
        context_summary: { type: 'string', description: 'Optional recent context summary. Do not paste full conversation unless necessary.' },
        run_in_background: {
          type: 'boolean',
          description: 'Set true for long tasks. Returns immediately with agent_id; use wait_agent for results.',
          default: false,
        },
        timeout_ms: {
          type: 'number',
          description: 'Foreground wait timeout in milliseconds. Default 180000, max 180000.',
          default: DEFAULT_SPAWN_WAIT_TIMEOUT_MS,
          maximum: 180000,
        },
      },
      required: ['description', 'prompt'],
      additionalProperties: false,
    },
  },
  isReadonly: true,
  isConcurrencySafe: true,
  async execute(args, ctx) {
    const summary = subAgentManager.spawn(
      {
        taskName: stringArg(args, 'description'),
        prompt: stringArg(args, 'prompt'),
        role: optionalStringArg(args, 'subagent_type'),
        contextSummary: optionalStringArg(args, 'context_summary'),
      },
      requireRuntime(ctx),
    );
    if (booleanArg(args, 'run_in_background', false)) {
      return agentResult(summary, 'spawn', {
        result: `Sub-agent started in background. Use wait_agent with agent_id "${summary.id}" to retrieve results.`,
      });
    }

    const timeoutMs = optionalNumberArg(args, 'timeout_ms') ?? DEFAULT_SPAWN_WAIT_TIMEOUT_MS;
    const waited = ctx.signal
      ? await subAgentManager.wait(summary.id, timeoutMs, ctx.signal)
      : await subAgentManager.wait(summary.id, timeoutMs);
    return agentResult(waited.summary, 'spawn', {
      timedOut: waited.timedOut,
      result: waited.timedOut
        ? `Sub-agent is still running in background. Use wait_agent with agent_id "${summary.id}" to retrieve results.`
        : waited.summary.result,
    });
  },
};

export const waitAgentTool: ToolExecutor = {
  definition: {
    name: 'wait_agent',
    description: 'Wait for a background sub-agent and return its latest summary. Use after spawn_agent with run_in_background=true, or after a previous timeout.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent id returned by spawn_agent.' },
        timeout_ms: {
          type: 'number',
          description: 'Timeout in milliseconds. Default 60000, max 180000.',
          default: 60000,
          maximum: 180000,
        },
      },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  isReadonly: true,
  async execute(args, ctx) {
    const agentId = stringArg(args, 'agent_id');
    const timeoutMs = optionalNumberArg(args, 'timeout_ms');
    const result = ctx.signal
      ? await subAgentManager.wait(agentId, timeoutMs, ctx.signal)
      : await subAgentManager.wait(agentId, timeoutMs);
    return agentResult(result.summary, 'wait', { timedOut: result.timedOut });
  },
};

export const sendAgentInputTool: ToolExecutor = {
  definition: {
    name: 'send_agent_input',
    description: 'Send follow-up instructions to a completed, errored, cancelled, or timed-out sub-agent and run it again with the same read-only constraints. Call wait_agent first if it is still running.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent id returned by spawn_agent.' },
        input: { type: 'string', description: 'Follow-up read-only instructions.' },
      },
      required: ['agent_id', 'input'],
      additionalProperties: false,
    },
  },
  isReadonly: true,
  async execute(args, ctx) {
    const summary = subAgentManager.sendInput(
      stringArg(args, 'agent_id'),
      stringArg(args, 'input'),
      requireRuntime(ctx),
    );
    return agentResult(summary, 'send_input');
  },
};

export const listAgentsTool: ToolExecutor = {
  definition: {
    name: 'list_agents',
    description: 'List sub-agents created in this app process, newest first. Use to discover running background agents or retrieve ids.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'errored', 'cancelled', 'closed', 'not_found'],
          description: 'Optional status filter.',
        },
      },
      additionalProperties: false,
    },
  },
  isReadonly: true,
  isConcurrencySafe: true,
  async execute(args) {
    const status = optionalStringArg(args, 'status');
    const agents = subAgentManager.list().filter((agent) => !status || agent.status === status);
    const metadata: AgentToolMetadata = {
      kind: 'agent',
      action: 'list',
      agentIds: agents.map((agent) => agent.id),
      agents,
    };
    return {
      content: jsonContent({ agents }),
      metadata,
    };
  },
};

export const closeAgentTool: ToolExecutor = {
  definition: {
    name: 'close_agent',
    description: 'Stop a running sub-agent or mark an existing sub-agent closed. Closed agents remain visible in list_agents but cannot be resumed.',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent id returned by spawn_agent.' },
      },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  isReadonly: true,
  async execute(args) {
    const summary = subAgentManager.close(stringArg(args, 'agent_id'));
    return agentResult(summary, 'close');
  },
};
