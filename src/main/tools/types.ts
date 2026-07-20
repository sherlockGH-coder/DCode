import { ToolDefinition, ToolCall, ToolResult, ToolResultContentBlock, ToolResultMetadata, Attachment, AgentLoopConfig } from '../../shared/types';
import { approvalService, ApprovalRequest } from '../approvalService';
import { projectManager } from '../project';
import { resolve } from 'node:path';
import { resolveInside } from '../pathSandbox';
import { isPathAllowedInSession } from '../pathAllowList';
import { buildLineDiff, buildAllAddedDiff } from './diffUtil';
import { settingsManager } from '../settings';
import { getConversationModeState } from '../plan/planService';
import {
  detectOutOfScopeFileAccess,
  isProjectScopedReadonlyTool,
  type OutOfScopeFileAccess,
} from './filePermissionPolicy';

const APPROVAL_FREE_READONLY_TOOLS = new Set([
  'load_skill',
  'ask_user_question',
  'spawn_agent',
  'wait_agent',
  'send_agent_input',
  'list_agents',
  'close_agent',
]);
const LOCAL_FILE_MUTATION_TOOLS = new Set(['write_file', 'edit_file']);
const LOCAL_STATE_TOOLS = new Set(['update_plan', 'submit_plan']);
const SUB_AGENT_DENY_TOOLS = new Set([
  'ask_user_question',
  'spawn_agent',
  'wait_agent',
  'send_agent_input',
  'list_agents',
  'close_agent',
  'bash_exec',
  'write_file',
  'edit_file',
  'update_plan',
]);

export interface ToolExecutionContext {
  projectPath: string | null;
  /** 当前 toolCall 的 id（工具用于审批请求等需要回写状态的场景） */
  toolCallId: string;
  /** 本回合用户附件 — key 是绝对路径，value 携带 mimeType / kind 等元数据 */
  attachmentWhitelist?: Map<string, Attachment>;
  /** 日志追踪 ID */
  traceId?: string;
  conversationId?: string | null;
  turnId?: string;
  attemptNo?: number;
  /** 发起对话的窗口 webContents id；审批请求应优先回到这个窗口 */
  approvalWebContentsId?: number;
  /**
   * 工具审批策略（定时任务用）：
   * - 'auto-deny'：自动拒绝需要审批的工具调用（默认，安全）
   * - 'auto-approve'：自动批准所有工具调用（危险，仅用于可信任务）
   * - undefined：正常弹出审批窗口等待用户决策
   */
  approvalPolicy?: 'auto-deny' | 'auto-approve';
  /** 子 Agent 使用更窄的只读工具策略，禁止问用户和再派生 Agent。 */
  subAgent?: boolean;
  /** 当前 loop 的运行配置快照，协作工具用来派生只读子 Agent。 */
  agentRuntime?: AgentLoopConfig & { toolRegistry: ToolRegistry };
  /** 用户中止或调度器取消当前工具批次时触发。工具应尽快停止可取消的工作。 */
  signal?: AbortSignal;
  collaborationMode?: 'execute' | 'plan';
  modeRevision?: number;
}

export interface ToolExecuteResult {
  content: string;
  contentBlocks?: ToolResultContentBlock[];
  metadata?: ToolResultMetadata;
  /** 是否作为错误展示（如用户拒绝审批）；默认 false */
  error?: boolean;
  terminal?: boolean;
}

export interface ToolExecutor {

  definition: ToolDefinition;
  /** 是否可与其他安全工具并行执行（默认 false） */
  isConcurrencySafe?: boolean;
  /** 是否为只读工具（子 Agent 只读策略依赖；默认 false） */
  isReadonly?: boolean;

  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecuteResult>;
}

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();

  /**
   * 注册工具
   */
  register(executor: ToolExecutor): void {
    this.tools.set(executor.definition.name, executor);
  }

  /**
   * 注销工具（MCP server 断开 / 删除时用）
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 获取所有工具定义（发送给 API）
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  getDefinitionsForMode(mode: 'execute' | 'plan'): ToolDefinition[] {
    if (mode === 'execute') {
      return Array.from(this.tools.values())
        .filter((tool) => tool.definition.name !== 'submit_plan')
        .map((tool) => tool.definition);
    }
    return Array.from(this.tools.values())
      .filter((tool) => PLAN_MODE_ALLOWED_TOOLS.has(tool.definition.name))
      .map((tool) => tool.definition);
  }

  /**
   * 获取只读工具定义（仅返回 isReadonly 为 true 的工具）
   */
  getReadonlyDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.isReadonly)
      .map(t => t.definition);
  }

  /**
   * 获取子 Agent 工具定义：只读工具，但禁止向用户提问和创建更多 Agent。
   */
  getSubAgentReadonlyDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.isReadonly && !SUB_AGENT_DENY_TOOLS.has(t.definition.name))
      .map(t => t.definition);
  }

  /**
   * 查询工具是否为只读工具
   */
  isReadonlyTool(name: string): boolean {
    return this.tools.get(name)?.isReadonly ?? false;
  }

  /**
   * 查询工具是否并发安全
   */
  isConcurrencySafe(name: string): boolean {
    return this.tools.get(name)?.isConcurrencySafe ?? false;
  }

  /**
   * 执行工具调用
   *
   * @param ctx — 不含 toolCallId 的基础上下文，本方法会从 toolCall 注入
   */
  async execute(toolCall: ToolCall, ctx: Omit<ToolExecutionContext, 'toolCallId'>): Promise<ToolResult> {
    const executor = this.tools.get(toolCall.function.name);

    if (!executor) {
      return {
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
        error: true,
      };
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);

      const name = toolCall.function.name;
      const modeError = validateModePermission(name, ctx);
      if (modeError) {
        return {
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({ error: modeError }),
          error: true,
        };
      }
      const outOfScope = detectOutOfScope(name, args, ctx);
      if (ctx.subAgent && !isAllowedSubAgentTool(name, executor)) {
        return {
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({
            error: 'Sub-agents are read-only and cannot ask the user, mutate files, run shell commands, or spawn agents.',
          }),
          error: true,
        };
      }

      if (!shouldSkipToolApproval(name, ctx, executor, outOfScope)) {
        const approvalKind = approvalKindFor(name, args);
        if (approvalKind) {

          if (outOfScope && isPathAllowedInSession(ctx.conversationId, outOfScope.absolutePath)) {

          } else if (ctx.approvalPolicy === 'auto-deny') {

            return {
              tool_call_id: toolCall.id,
              name,
              content: `[Auto-denied] 定时任务配置为自动拒绝需要审批的工具调用。如需执行此操作，请修改任务的审批策略。`,
              error: true,
            };
          } else if (ctx.approvalPolicy === 'auto-approve') {

          } else {

            const diffPreview = await approvalDiffPreview(name, args, ctx);
            const decision = await approvalService.request({
              toolCallId: toolCall.id,
              kind: approvalKind,
              command: approvalDisplayText(name, args),
              description: approvalDescriptionText(name, args),
              cwd: projectManager.getCwdForProject(ctx.projectPath),
              traceId: ctx.traceId,
              conversationId: ctx.conversationId,
              turnId: ctx.turnId,
              attemptNo: ctx.attemptNo,
              targetWebContentsId: ctx.approvalWebContentsId,
              diffPreview,
              outOfScope: outOfScope ?? undefined,
            });
            if (!decision.allowed) {
              return {
                tool_call_id: toolCall.id,
                name,
                content: `[Denied by user] ${decision.reason || '用户拒绝执行'}`,
                error: true,
              };
            }
          }
        }
      }

      if (ctx.signal?.aborted) {
        return {
          tool_call_id: toolCall.id,
          name,
          content: '[Aborted] 用户中止了执行',
          error: true,
        };
      }

      const result = await executor.execute(args, { ...ctx, toolCallId: toolCall.id });
      return {
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: result.content,
        contentBlocks: result.contentBlocks,
        metadata: result.metadata,
        error: result.error,
        terminal: result.terminal,
      };
    } catch (err) {
      if (ctx.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return {
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: '[Aborted] 用户中止了执行',
          error: true,
        };
      }
      return {
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        error: true,
      };
    }
  }
}

export const PLAN_MODE_ALLOWED_TOOLS = new Set([
  'read_file',
  'grep',
  'glob',
  'web_search',
  'web_fetch',
  'load_skill',
  'ask_user_question',
  'submit_plan',
]);

function validateModePermission(
  name: string,
  ctx: Omit<ToolExecutionContext, 'toolCallId'>,
): string | null {
  if (!ctx.collaborationMode) return null;
  if (!ctx.conversationId) return 'Mode-aware tool execution requires a conversation';
  const state = getConversationModeState(ctx.conversationId);
  if (state.mode === 'transitioning_to_execute') return 'Mode transition is in progress';
  if (state.mode !== ctx.collaborationMode || state.modeRevision !== ctx.modeRevision) {
    return 'Tool call rejected because the conversation mode changed';
  }
  if (state.mode === 'plan' && !PLAN_MODE_ALLOWED_TOOLS.has(name)) {
    return `Tool "${name}" is not allowed in Plan mode`;
  }
  if (state.mode === 'execute' && name === 'submit_plan') {
    return 'submit_plan is only allowed in Plan mode';
  }
  return null;
}

function detectOutOfScope(
  name: string,
  args: Record<string, unknown>,
  ctx: Omit<ToolExecutionContext, 'toolCallId'>,
): OutOfScopeFileAccess | null {
  if (name === 'read_file') {
    const rawPath = args.file_path;
    if (typeof rawPath === 'string' && ctx.attachmentWhitelist?.has(resolve(rawPath))) {
      return null;
    }
  }
  return detectOutOfScopeFileAccess(name, args, ctx.projectPath);
}

function isAllowedSubAgentTool(name: string, executor: ToolExecutor): boolean {
  if (SUB_AGENT_DENY_TOOLS.has(name)) return false;
  return executor.isReadonly === true;
}

function shouldSkipToolApproval(
  name: string,
  ctx: Omit<ToolExecutionContext, 'toolCallId'>,
  executor: ToolExecutor,
  outOfScope: OutOfScopeFileAccess | null,
): boolean {
  if (name === 'bash_exec') return false;
  if (name === 'ask_user_question') return true;
  if (LOCAL_STATE_TOOLS.has(name)) return true;
  if (isApprovalFreeReadonlyTool(name, executor)) return true;
  if (isProjectScopedReadonlyTool(name) && !outOfScope) return true;
  if (ctx.subAgent && isAllowedSubAgentTool(name, executor) && !outOfScope) return true;

  if (ctx.approvalPolicy === 'auto-approve') return true;
  if (ctx.approvalPolicy === 'auto-deny') return false;

  const policy = settingsManager.getBashPolicy();
  if (policy === 'full_access') return true;
  if (policy === 'auto_review' && LOCAL_FILE_MUTATION_TOOLS.has(name) && !outOfScope) return true;
  return false;
}

function isApprovalFreeReadonlyTool(name: string, executor: ToolExecutor): boolean {
  if (APPROVAL_FREE_READONLY_TOOLS.has(name)) return true;
  return false;
}

function approvalKindFor(name: string, args: Record<string, unknown>): ApprovalRequest['kind'] | null {
  switch (name) {
    case 'read_file':   return 'read_file';
    case 'write_file':  return 'write_file';
    case 'edit_file':   return 'edit_file';
    case 'grep':        return 'grep';
    case 'glob':        return 'glob';
    case 'web_search':  return 'web_search';
    case 'web_fetch':   return 'web_fetch';
    default:
      if (APPROVAL_FREE_READONLY_TOOLS.has(name) || name === 'bash_exec' || name === 'ask_user_question') return null;
      return 'external_tool';
  }
}

function approvalDisplayText(name: string, args: Record<string, unknown>): string {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = args[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };
  switch (name) {
    case 'read_file':
      return pick('file_path');
    case 'write_file':
      return pick('file_path');
    case 'edit_file':
      return pick('file_path');
    case 'grep':
      return pick('pattern', 'query');
    case 'glob':
      return pick('pattern');
    case 'web_search':
      return pick('query');
    case 'web_fetch':
      return pick('url');
    default:
      return name;
  }
}

function approvalDescriptionText(name: string, args: Record<string, unknown>): string | undefined {
  if (approvalKindFor(name, args) === 'external_tool') {
    const preview = JSON.stringify(args).slice(0, 240);
    return preview ? `参数: ${preview}` : undefined;
  }
  return undefined;
}

/** 为审批面板生成 edit/write 工具的 diff 预览（异步，需要读文件定位行号） */
async function approvalDiffPreview(
  name: string,
  args: Record<string, unknown>,
  ctx: Omit<ToolExecutionContext, 'toolCallId'>,
): Promise<string | undefined> {
  if (name === 'edit_file') {
    const oldStr = args.old_string;
    const newStr = args.new_string;
    if (typeof oldStr !== 'string' || typeof newStr !== 'string') return undefined;

    let oldStartLine = 1;
    try {
      const rawPath = args.file_path as string;
      if (typeof rawPath === 'string' && rawPath.length > 0) {
        const { absolutePath } = resolveInside(rawPath, ctx.projectPath);
        const { readFile } = await import('node:fs/promises');
        const content = await readFile(absolutePath, 'utf-8');
        const idx = content.indexOf(oldStr);
        if (idx !== -1) {
          oldStartLine = content.slice(0, idx).split('\n').length;
        }
      }
    } catch {

    }

    return buildLineDiff(oldStr, newStr, oldStartLine, oldStartLine);
  }
  if (name === 'write_file') {
    const content = args.content;
    if (typeof content === 'string' && content.length > 0) {
      return buildAllAddedDiff(content);
    }
  }
  return undefined;
}
