import type { Message, PlanUpdateItem, ToolCall, ToolItem, ToolResultMetadata } from '../../shared/types';
import { nameToKind } from './toolDescriptions';

const INTERRUPTED_ASK_USER_OUTPUT = '问题已失效：应用重启后，原来的等待确认无法继续。请重新发送或继续输入。';

function parseLegacyAskUserAnswers(output?: string): Record<string, string> | undefined {
  if (!output?.includes('用户已作答：')) return undefined;
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

/** 从 tool_call 创建初始 ToolItem（status=running） */
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
  try { args = JSON.parse(event.arguments); } catch {              }

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

/** 用 metadata 更新 ToolItem 为完成/错误状态 */
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
      return { ...item, status, kind: 'read', path: metadata.path, lineCount: metadata.lineCount, truncated: metadata.truncated, output } as ToolItem;
    case 'write':
      return { ...item, status, kind: 'write', path: metadata.path, isNew: metadata.isNew, diff: metadata.diff } as ToolItem;
    case 'edit':
      return { ...item, status, kind: 'edit', path: metadata.path, linesAdded: metadata.linesAdded, linesDeleted: metadata.linesDeleted, diff: metadata.diff } as ToolItem;
    case 'exec':
      return { ...item, status, kind: 'exec', command: metadata.command, exitCode: metadata.exitCode, duration: metadata.duration, outputLines: metadata.outputLines, output } as ToolItem;
    case 'grep':
      return { ...item, status, kind: 'grep', pattern: metadata.pattern, matchCount: metadata.matchCount, fileCount: metadata.fileCount, output } as ToolItem;
    case 'glob':
      return { ...item, status, kind: 'glob', pattern: metadata.pattern, matchCount: metadata.matchCount, output } as ToolItem;
    case 'web_search':
      return { ...item, status, kind: 'web_search', query: metadata.query, resultCount: metadata.resultCount, output } as ToolItem;
    case 'web_fetch':
      return { ...item, status, kind: 'web_fetch', url: metadata.url, title: metadata.title, charCount: metadata.charCount, provider: metadata.provider, output } as ToolItem;
    case 'vision':
      return { ...item, status, kind: 'vision', path: metadata.path, question: metadata.question, provider: metadata.provider, model: metadata.model, output } as ToolItem;
    case 'list_directory':
      return { ...item, status, kind: 'list_directory', path: metadata.path, totalCount: metadata.totalCount, output } as ToolItem;
    case 'task':
      return { ...item, status, kind: 'task', action: metadata.action, taskId: metadata.taskId, title: metadata.title, output } as ToolItem;
    case 'plan_update':
      return { ...item, status, kind: 'plan_update', explanation: metadata.explanation, plan: metadata.plan, output } as ToolItem;
    case 'plan_artifact':
      return { ...item, status, kind: 'plan_artifact', title: metadata.plan.title, plan: metadata.plan, output } as ToolItem;
    case 'ask_user_question':
      const existingQuestions = item.kind === 'ask_user_question' ? item.questions : undefined;
      return {
        ...item,
        status,
        kind: 'ask_user_question',
        questions: metadata.questions.length > 0 ? metadata.questions : existingQuestions,
        answers: metadata.answers,
        output,
      } as ToolItem;
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
      } as ToolItem;
    default:
      return { ...item, status, output } as ToolItem;
  }
}

/**
 * 从持久化的 tool_calls + tool 消息重建 ToolItem[]
 * 用于加载历史对话时恢复工具活动 UI
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
      items.push(applyMetadata(baseItem, toolMsg.metadata, status, toolMsg.content) as ToolItem);
    } else if (baseItem.kind === 'ask_user_question') {

      items.push({ ...baseItem, status: 'error', output: INTERRUPTED_ASK_USER_OUTPUT });
    } else {

      items.push(baseItem);
    }
  }
  return items;
}
