import type { Message, PlanUpdateItem, ToolCall, ToolItem, ToolResultMetadata } from '../../shared/types';
import { nameToKind } from './toolDescriptions';

const INTERRUPTED_ASK_USER_OUTPUT = 'This question expired because the app was restarted. The previous pending confirmation cannot continue. Send it again or continue typing.';

function parseLegacyAskUserAnswers(output?: string): Record<string, string> | undefined {
  if (!output || (!output.includes('User answer:') && !output.includes('\u7528\u6237\u5df2\u4f5c\u7b54\uff1a'))) return undefined;
  const entries = [...output.matchAll(/"([^"]+)"="([^"]*)"/g)].map((match) => [match[1], match[2]] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function taskActionFromName(name: string): string {
  switch (name) {
    case 'task_create':
    case 'TaskCreate': return 'create';
    case 'task_get':
    case 'TaskGet': return 'get';
    case 'task_list':
    case 'TaskList': return 'list';
    case 'task_update':
    case 'TaskUpdate': return 'update';
    case 'task_output':
    case 'TaskOutput': return 'output';
    case 'task_stop':
    case 'TaskStop': return 'stop';
    default: return '';
  }
}

function agentActionFromName(name: string): 'spawn' | 'wait' | 'send_input' | 'list' | 'close' {
  switch (name) {
    case 'spawn_agent': return 'spawn';
    case 'wait_agent': return 'wait';
    case 'send_agent_input': return 'send_input';
    case 'list_agents': return 'list';
    case 'close_agent': return 'close';
    default: return 'list';
  }
}

function parsePlanItems(value: unknown): PlanUpdateItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const step = typeof candidate.step === 'string' ? candidate.step : '';
    const status = candidate.status;
    if (status !== 'pending' && status !== 'in_progress' && status !== 'completed') return [];
    return [{ step, status }];
  });
}

/** Create the initial ToolItem from a tool_call with status=running. */
export function createToolItemFromStart(event: { id: string; name: string; arguments: string }): ToolItem {
  const kind = nameToKind(event.name);
  const base = {
    id: `ti_${event.id}`,
    toolCallId: event.id,
    name: event.name,
    status: 'running' as const,
    timestamp: Date.now(),
  };

  let args: Record<string, unknown> = {};
  try { args = JSON.parse(event.arguments); } catch {}

  switch (kind) {
    case 'read':
      return { ...base, kind: 'read', path: (args.file_path as string) ?? '' };
    case 'write':
      return { ...base, kind: 'write', path: (args.file_path as string) ?? '' };
    case 'edit':
      return { ...base, kind: 'edit', path: (args.file_path as string) ?? '' };
    case 'exec':
      return { ...base, kind: 'exec', command: (args.command as string) ?? '' };
    case 'grep':
      return { ...base, kind: 'grep', pattern: (args.pattern as string) ?? '', path: (args.path as string) ?? undefined };
    case 'glob':
      return { ...base, kind: 'glob', pattern: (args.pattern as string) ?? '' };
    case 'web_search':
      return { ...base, kind: 'web_search', query: (args.query as string) ?? '' };
    case 'web_fetch':
      return { ...base, kind: 'web_fetch', url: (args.url as string) ?? '' };
    case 'vision':
      return { ...base, kind: 'vision', path: (args.path as string) ?? '', question: (args.question as string) ?? '' };
    case 'list_directory':
      return { ...base, kind: 'list_directory', path: (args.path as string) ?? '' };
    case 'task':
      return { ...base, kind: 'task', action: taskActionFromName(event.name), taskId: (args.id as string) ?? '', title: (args.title as string) ?? (args.description as string) ?? '' };
    case 'plan_update':
      return { ...base, kind: 'plan_update', explanation: (args.explanation as string) ?? undefined, plan: parsePlanItems(args.plan) };
    case 'plan_artifact':
      return { ...base, kind: 'plan_artifact', title: (args.title as string) ?? undefined };
    case 'ask_user_question':
      return { ...base, kind: 'ask_user_question', questions: (args.questions as any) ?? [] };
    case 'agent':
      return {
        ...base,
        kind: 'agent',
        action: agentActionFromName(event.name),
        agentId: (args.agent_id as string) ?? undefined,
        taskName: (args.description as string) ?? (args.task_name as string) ?? undefined,
        role: (args.subagent_type as string) ?? (args.role as string) ?? undefined,
      };
    default:
      return { ...base, kind: 'tool', toolName: event.name, input: event.arguments };
  }
}

/** Update a ToolItem to a completed or error state using metadata. */
export function applyMetadata(item: ToolItem, metadata: ToolResultMetadata | undefined, status: 'done' | 'error', output?: string): ToolItem {
  if (!metadata) {
    if (item.kind === 'ask_user_question') {
      return {
        ...item,
        status,
        answers: item.answers ?? parseLegacyAskUserAnswers(output),
        output,
      };
    }
    return { ...item, status, output } as ToolItem;
  }
  switch (metadata.kind) {
    case 'read':
      return { ...item, status, kind: 'read', path: metadata.path, lineCount: metadata.lineCount, truncated: metadata.truncated, output };
    case 'write':
      return { ...item, status, kind: 'write', path: metadata.path, isNew: metadata.isNew, diff: metadata.diff };
    case 'edit':
      return { ...item, status, kind: 'edit', path: metadata.path, linesAdded: metadata.linesAdded, linesDeleted: metadata.linesDeleted, diff: metadata.diff };
    case 'exec':
      return { ...item, status, kind: 'exec', command: metadata.command, exitCode: metadata.exitCode, duration: metadata.duration, outputLines: metadata.outputLines, output };
    case 'grep':
      return { ...item, status, kind: 'grep', pattern: metadata.pattern, matchCount: metadata.matchCount, fileCount: metadata.fileCount, output };
    case 'glob':
      return { ...item, status, kind: 'glob', pattern: metadata.pattern, matchCount: metadata.matchCount, output };
    case 'web_search':
      return { ...item, status, kind: 'web_search', query: metadata.query, resultCount: metadata.resultCount, output };
    case 'web_fetch':
      return { ...item, status, kind: 'web_fetch', url: metadata.url, title: metadata.title, charCount: metadata.charCount, provider: metadata.provider, output };
    case 'vision':
      return { ...item, status, kind: 'vision', path: metadata.path, question: metadata.question, provider: metadata.provider, model: metadata.model, output };
    case 'list_directory':
      return { ...item, status, kind: 'list_directory', path: metadata.path, totalCount: metadata.totalCount, output };
    case 'task':
      return { ...item, status, kind: 'task', action: metadata.action, taskId: metadata.taskId, title: metadata.title, output };
    case 'plan_update':
      return { ...item, status, kind: 'plan_update', explanation: metadata.explanation, plan: metadata.plan, output };
    case 'plan_artifact':
      return { ...item, status, kind: 'plan_artifact', title: metadata.plan.title, plan: metadata.plan, output };
    case 'ask_user_question': {
      const existingQuestions = item.kind === 'ask_user_question' ? item.questions : undefined;
      return {
        ...item,
        status,
        kind: 'ask_user_question',
        questions: metadata.questions.length > 0 ? metadata.questions : existingQuestions,
        answers: metadata.answers,
        output,
      };
    }
    case 'agent':
      return {
        ...item,
        status,
        kind: 'agent',
        action: metadata.action,
        agentId: metadata.agentId,
        agentIds: metadata.agentIds,
        taskName: metadata.taskName,
        role: metadata.role,
        agentStatus: metadata.status,
        agents: metadata.agents,
        timedOut: metadata.timedOut,
        output,
      };
    default:
      return { ...item, status, output } as ToolItem;
  }
}

/**
 * Rebuild ToolItem[] from persisted tool_calls and tool messages.
 * Used to restore tool activity UI when loading a historical conversation.
 */
export function reconstructToolItems(
  toolCalls: ToolCall[],
  toolMessages: Message[],
): ToolItem[] {
  const items: ToolItem[] = [];
  for (const tc of toolCalls) {

    const baseItem = createToolItemFromStart({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    });

    const toolMsg = toolMessages.find((m) => m.tool_call_id === tc.id);
    if (toolMsg) {

      const status: 'done' | 'error' = toolMsg.error ? 'error' : 'done';
      items.push(applyMetadata(baseItem, toolMsg.metadata, status, toolMsg.content));
    } else if (baseItem.kind === 'ask_user_question') {

      items.push({ ...baseItem, status: 'error', output: INTERRUPTED_ASK_USER_OUTPUT });
    } else {

      items.push(baseItem);
    }
  }
  return items;
}
