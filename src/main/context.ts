import { getOSInfo } from './utils/timeUtils';
import type { DeepseekMdSource } from './prompts';

/**
 * Return a daily-stable date string with its timezone.
 * The date is injected as a tail reminder at day granularity to avoid meaningless per-second changes.
 */
function getStableDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const tzOffset = -now.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const th = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tm = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  return `${y}/${m}/${d} (UTC${sign}${th}:${tm})`;
}

interface SystemContext {
  /** Operating-system information, stable within a session. */
  environmentInfo?: string;
  /** Project path, stable within a session. */
  projectPath?: string;
}

/**
 * Get the System Context, containing environment information stable within a session.
 * This information is appended to the system prompt and benefits from caching.
 */
export function getSystemContext(projectPath: string | null, environmentInfoOverride?: string): SystemContext {
  const context: SystemContext = {};

  const lines = environmentInfoOverride
    ? [environmentInfoOverride]
    : [`- Operating system: ${getOSInfo()}`];
  if (projectPath) {
    lines.push(`- Project path: ${projectPath}`);
    lines.push(`- Default tool working directory: ${projectPath}`);
  }
  context.environmentInfo = lines.join('\n');

  if (projectPath) {
    context.projectPath = projectPath;
  }

  return context;
}

/**
 * Format SystemContext as text that can be appended to the system prompt.
 */
export function formatSystemContext(context: SystemContext): string {
  const parts: string[] = [];

  if (context.environmentInfo) {
    parts.push(`# Runtime environment\n${context.environmentInfo}`);
  }

  return parts.join('\n\n');
}

interface UserContext {
  /** DEEPSEEK.md sources, including file path, contents, and scope. */
  deepseekMdSources?: DeepseekMdSource[];
  /** Current date, refreshed for every request. */
  currentDate?: string;
  /** Memory context shared across conversations. */
  memoryContext?: string;
  /** Skills list. */
  skillsContext?: string;
  /** MCP server instructions for connected servers that declare them. */
  mcpInstructionsContext?: string;
  /** Attachment list. */
  attachmentsContext?: string;
}

/**
 * Get the User Context.
 * Stable information is injected as the first hidden user message; dynamic and turn-specific information is injected as a hidden tail user message.
 */
export function getUserContext(options: {
  deepseekMdSources?: DeepseekMdSource[];
  memoryContext?: string;
  enabledSkills?: Array<{ name: string; description: string }>;
  /** Instructions for connected MCP servers, keyed by server name. */
  mcpInstructions?: Array<{ serverName: string; instructions: string }>;
  attachments?: Array<{ path: string; mimeType: string; size: number; kind: string }>;
}): UserContext {
  const context: UserContext = {};

  if (options.deepseekMdSources && options.deepseekMdSources.length > 0) {
    context.deepseekMdSources = options.deepseekMdSources;
  }

  context.currentDate = `Today's date: ${getStableDateString()}`;

  if (options.memoryContext) {
    context.memoryContext = options.memoryContext;
  }

  if (options.enabledSkills && options.enabledSkills.length > 0) {
    const lines = options.enabledSkills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join('\n');
    context.skillsContext = `When one of the following skills matches the user's request, call \`load_skill(name)\` first to load its full instructions, then execute it. Multiple skills may be loaded sequentially in the same turn when needed:\n${lines}`;
  }

  if (options.mcpInstructions && options.mcpInstructions.length > 0) {
    const blocks = options.mcpInstructions
      .map((m) => `## ${m.serverName}\n${m.instructions.trim()}`)
      .join('\n\n');
    context.mcpInstructionsContext = blocks;
  }

  if (options.attachments && options.attachments.length > 0) {
    const lines = options.attachments
      .map((a) => {
        const sizeKb = Math.round(a.size / 1024);
        return `- ${a.path} (${a.mimeType}, ${sizeKb}KB, ${a.kind})`;
      })
      .join('\n');
    context.attachmentsContext = `The current message includes the following files. Use read_file to inspect text, PDF, Office, and other documents as needed.\n${lines}`;
  }

  return context;
}

/**
 * Format stable UserContext as the leading <system-reminder> message content.
 *
 * Include only low-frequency stable content so turn-specific attachments, dates, and skill discovery do not invalidate the cached prefix.
 */
export function formatUserContext(context: UserContext): string {
  const parts: string[] = [];

  if (context.deepseekMdSources && context.deepseekMdSources.length > 0) {
    const blocks = context.deepseekMdSources.map((source) => {
      const scopeLabel =
        source.scope === 'user'
          ? "user's private global instructions for all projects"
          : source.scope === 'local'
          ? "project-local instructions (not checked into the codebase)"
          : "project instructions, checked into the codebase";

      return `Contents of ${source.filePath} (${scopeLabel}):\n\n${source.contents}`;
    });

    parts.push(`# DEEPSEEK.md instructions\n\n<INSTRUCTIONS>\n${blocks.join('\n\n')}\n</INSTRUCTIONS>`);
  }

  if (context.mcpInstructionsContext) {
    parts.push(`# MCP Server Instructions\nThe following MCP servers are connected. Follow their instructions when using their tools:\n\n${context.mcpInstructionsContext}`);
  }

  if (parts.length === 0) return '';

  return `<system-reminder>
As an AI assistant, use the following stable context when answering the user's question:

${parts.join('\n\n')}

Important: this context may or may not be relevant to the current task. Use your judgment.
</system-reminder>`;
}

/**
 * Format dynamic UserContext as the trailing <system-reminder> message content.
 *
 * These values change more often, so placing them at the end preserves the cached prefix above.
 */
export function formatTailUserContext(context: UserContext): string {
  const parts: string[] = [];

  if (context.memoryContext) {
    parts.push(`# Memory\nThe following cross-conversation memory contains user preferences and project background. Refer to it when answering, but do not mention it unless needed:\n${context.memoryContext}`);
  }

  if (context.skillsContext) {
    parts.push(`# Available Skills\n${context.skillsContext}`);
  }

  if (context.attachmentsContext) {
    parts.push(`# Attachments\n${context.attachmentsContext}`);
  }

  if (context.currentDate) {
    parts.push(`# Current date\n${context.currentDate}`);
  }

  if (parts.length === 0) return '';

  return `<system-reminder>
As an AI assistant, use the following turn-specific context when answering the user's question:

${parts.join('\n\n')}

Important: this context may or may not be relevant to the current task. Use your judgment.
</system-reminder>`;
}
