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
  /** Current toolCall ID, used when a tool must write state back, such as approval requests. */
  toolCallId: string;
  /** Attachments for this turn; keys are absolute paths and values carry mimeType, kind, and other metadata. */
  attachmentWhitelist?: Map<string, Attachment>;
  /** Current trace ID, used to associate console debug output with approval requests. */
  traceId?: string;
  conversationId?: string | null;
  turnId?: string;
  attemptNo?: number;
  /** webContents ID of the window that started the conversation; approval requests should return to this window first. */
  approvalWebContentsId?: number;
  /**
   * Tool approval policy, used by scheduled tasks:
   * - 'auto-deny': automatically deny tool calls that require approval (safe default).
   * - 'auto-approve': automatically approve all tool calls (dangerous; trusted tasks only).
   * - undefined: show the normal approval prompt and wait for the user.
   */
  approvalPolicy?: 'auto-deny' | 'auto-approve';
  /** Child agents use a narrower read-only tool policy and cannot ask the user or spawn more agents. */
  subAgent?: boolean;
  /** Snapshot of the current loop configuration, used by collaboration tools to spawn read-only child agents. */
  agentRuntime?: AgentLoopConfig & { toolRegistry: ToolRegistry };
  /** Fired when the user aborts or the scheduler cancels the current tool batch. Tools should stop cancellable work promptly. */
  signal?: AbortSignal;
  collaborationMode?: 'execute' | 'plan';
  modeRevision?: number;
}

export interface ToolExecuteResult {
  content: string;
  contentBlocks?: ToolResultContentBlock[];
  metadata?: ToolResultMetadata;
  /** Whether to display this as an error, such as when the user denies approval; false by default. */
  error?: boolean;
  terminal?: boolean;
}

export interface ToolExecutor {

  definition: ToolDefinition;
  /** Whether it can run in parallel with other safe tools; false by default. */
  isConcurrencySafe?: boolean;
  /** Whether this is a read-only tool, required by the child-agent read-only policy; false by default. */
  isReadonly?: boolean;

  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecuteResult>;
}

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();

  /**
   * Register a tool.
   */
  register(executor: ToolExecutor): void {
    this.tools.set(executor.definition.name, executor);
  }

  /**
   * Unregister a tool, used when an MCP server disconnects or is removed.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all tool definitions to send to the API.
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
   * Get read-only tool definitions, returning only tools with isReadonly true.
   */
  getReadonlyDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.isReadonly)
      .map(t => t.definition);
  }

  /**
   * Get child-agent tool definitions: read-only tools that cannot ask the user or create more agents.
   */
  getSubAgentReadonlyDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.isReadonly && !SUB_AGENT_DENY_TOOLS.has(t.definition.name))
      .map(t => t.definition);
  }

  /**
   * Check whether a tool is read-only.
   */
  isReadonlyTool(name: string): boolean {
    return this.tools.get(name)?.isReadonly ?? false;
  }

  /**
   * Check whether a tool is concurrency-safe.
   */
  isConcurrencySafe(name: string): boolean {
    return this.tools.get(name)?.isConcurrencySafe ?? false;
  }

  /**
   * Execute a tool call.
   *
   * @param ctx - Base context without toolCallId; this method injects it from toolCall.
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
        const approvalKind = approvalKindFor(name);
        if (approvalKind) {

          if (outOfScope && isPathAllowedInSession(ctx.conversationId, outOfScope.absolutePath)) {
            // This path was already allowed in the current session; execute directly.
          } else if (ctx.approvalPolicy === 'auto-deny') {

            return {
              tool_call_id: toolCall.id,
              name,
              content: `[Auto-denied] The scheduled-task policy automatically denies tool calls that require approval. Change the task approval policy to perform this operation.`,
              error: true,
            };
          } else if (ctx.approvalPolicy === 'auto-approve') {
            // The policy automatically approves; no prompt is needed.
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
                content: `[Denied by user] ${decision.reason || 'The user denied execution'}`,
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
          content: '[Aborted] The user stopped execution',
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
          content: '[Aborted] The user stopped execution',
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

const PLAN_MODE_ALLOWED_TOOLS = new Set([
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
  if (isApprovalFreeReadonlyTool(name)) return true;
  if (isProjectScopedReadonlyTool(name) && !outOfScope) return true;
  if (ctx.subAgent && isAllowedSubAgentTool(name, executor) && !outOfScope) return true;

  if (ctx.approvalPolicy === 'auto-approve') return true;
  if (ctx.approvalPolicy === 'auto-deny') return false;

  const policy = settingsManager.getBashPolicy();
  if (policy === 'full_access') return true;
  if (policy === 'auto_review' && LOCAL_FILE_MUTATION_TOOLS.has(name) && !outOfScope) return true;
  return false;
}

function isApprovalFreeReadonlyTool(name: string): boolean {
  return APPROVAL_FREE_READONLY_TOOLS.has(name);
}

function approvalKindFor(name: string): ApprovalRequest['kind'] | null {
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
  if (approvalKindFor(name) === 'external_tool') {
    const preview = JSON.stringify(args).slice(0, 240);
    return preview ? `Arguments: ${preview}` : undefined;
  }
  return undefined;
}

/** Generate a diff preview for edit/write tools in the approval panel; asynchronous because it reads files to locate line numbers. */
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
    } catch {}

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
