import { getOSInfo } from './utils/timeUtils';
import type { DcodeMdSource } from './prompts';

/**
 * 返回「每日稳定」的日期字符串（含时区）。
 * 日期会作为尾部 reminder 注入，仍保持天粒度，避免无意义的逐秒变化。
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

export interface SystemContext {
  /** 操作系统信息（会话内不变） */
  environmentInfo?: string;
  /** 项目路径（会话内不变） */
  projectPath?: string;
}

/**
 * 获取 System Context（会话内不变的环境信息）
 * 这些信息会被追加到 system prompt，享受缓存优化
 */
export function getSystemContext(projectPath: string | null): SystemContext {
  const context: SystemContext = {};

  const lines = [`- 操作系统: ${getOSInfo()}`];
  if (projectPath) {
    lines.push(`- 项目路径: ${projectPath}`);
    lines.push(`- 工具默认工作目录: ${projectPath}`);
  }
  context.environmentInfo = lines.join('\n');

  if (projectPath) {
    context.projectPath = projectPath;
  }

  return context;
}

/**
 * 将 SystemContext 格式化为可追加到 system prompt 的文本
 */
export function formatSystemContext(context: SystemContext): string {
  const parts: string[] = [];

  if (context.environmentInfo) {
    parts.push(`# 运行环境\n${context.environmentInfo}`);
  }

  return parts.join('\n\n');
}

export interface UserContext {
  /** DCODE.md 来源列表（包含文件路径、内容、scope） */
  dcodeMdSources?: DcodeMdSource[];
  /** 当前日期（每次请求时刷新） */
  currentDate?: string;
  /** Memory 上下文（跨对话记忆） */
  memoryContext?: string;
  /** Skills 列表 */
  skillsContext?: string;
  /** MCP server 使用说明（已连接且声明 instructions 的 server） */
  mcpInstructionsContext?: string;
  /** 附件列表 */
  attachmentsContext?: string;
}

/**
 * 获取 User Context。
 * 稳定信息会作为首条隐藏 user 消息注入；动态/本轮信息会作为尾部隐藏 user 消息注入。
 */
export function getUserContext(options: {
  dcodeMdSources?: DcodeMdSource[];
  memoryContext?: string;
  enabledSkills?: Array<{ name: string; description: string }>;
  /** 已连接 MCP server 的使用说明（server 名 → instructions 文本） */
  mcpInstructions?: Array<{ serverName: string; instructions: string }>;
  attachments?: Array<{ path: string; mimeType: string; size: number; kind: string }>;
}): UserContext {
  const context: UserContext = {};

  if (options.dcodeMdSources && options.dcodeMdSources.length > 0) {
    context.dcodeMdSources = options.dcodeMdSources;
  }

  context.currentDate = `今天的日期: ${getStableDateString()}`;

  if (options.memoryContext) {
    context.memoryContext = options.memoryContext;
  }

  if (options.enabledSkills && options.enabledSkills.length > 0) {
    const lines = options.enabledSkills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join('\n');
    context.skillsContext = `当下列 skill 与用户请求匹配时，先调用 \`load_skill(name)\` 获取完整指令再执行（必要时同一回合内可串行加载多个）：\n${lines}`;
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
    context.attachmentsContext = `本次消息附加了以下文件。文本、PDF/Office 等文档可使用 read_file 按需读取。\n${lines}`;
  }

  return context;
}

/**
 * 将稳定 UserContext 格式化为前置 <system-reminder> 消息内容
 *
 * 仅放低频稳定内容，避免本轮附件、日期、skill 发现列表等变化击穿缓存前缀。
 */
export function formatUserContext(context: UserContext): string {
  const parts: string[] = [];

  if (context.dcodeMdSources && context.dcodeMdSources.length > 0) {
    const blocks = context.dcodeMdSources.map((source) => {
      const scopeLabel =
        source.scope === 'user'
          ? "user's private global instructions for all projects"
          : source.scope === 'local'
          ? "project-local instructions (not checked into the codebase)"
          : "project instructions, checked into the codebase";

      return `Contents of ${source.filePath} (${scopeLabel}):\n\n${source.contents}`;
    });

    parts.push(`# DCODE.md instructions\n\n<INSTRUCTIONS>\n${blocks.join('\n\n')}\n</INSTRUCTIONS>`);
  }

  if (context.mcpInstructionsContext) {
    parts.push(`# MCP Server Instructions\n当前已连接以下 MCP server，使用其工具时请遵循对应的使用说明：\n\n${context.mcpInstructionsContext}`);
  }

  if (parts.length === 0) return '';

  return `<system-reminder>
作为 AI 助手，回答用户问题时可以使用以下稳定上下文信息：

${parts.join('\n\n')}

重要提示：此上下文信息可能与当前任务相关或无关，请根据实际情况判断是否使用。
</system-reminder>`;
}

/**
 * 将动态 UserContext 格式化为尾部 <system-reminder> 消息内容。
 *
 * 这些内容变化更频繁，放在对话尾部可以保住前面的缓存前缀。
 */
export function formatTailUserContext(context: UserContext): string {
  const parts: string[] = [];

  if (context.memoryContext) {
    parts.push(`# Memory\n以下是跨对话记忆，包含用户偏好和项目背景等信息，回答时参考但无需主动提及：\n${context.memoryContext}`);
  }

  if (context.skillsContext) {
    parts.push(`# Available Skills\n${context.skillsContext}`);
  }

  if (context.attachmentsContext) {
    parts.push(`# 附件清单\n${context.attachmentsContext}`);
  }

  if (context.currentDate) {
    parts.push(`# 当前日期\n${context.currentDate}`);
  }

  if (parts.length === 0) return '';

  return `<system-reminder>
作为 AI 助手，回答用户问题时可以使用以下本轮上下文信息：

${parts.join('\n\n')}

重要提示：此上下文信息可能与当前任务相关或无关，请根据实际情况判断是否使用。
</system-reminder>`;
}
