import type { ToolItem } from '../../shared/types';
import { collapsePath } from './collapsePath';

export interface ToolDescription {
  /** 动作动词，sans-serif 渲染（"Ran" / "Reading" / "Finding files:"） */
  verb: string;
  /** 命令、路径、模式等可变内容，等宽字体渲染 */
  target: string;
  /** 可选摘要，如 "120 lines" 或 "+3 -1" */
  detail?: string;
  /** 图标类型标识，由渲染层映射为实际图标组件 */
  iconType: 'file' | 'folder' | 'terminal' | 'search' | 'check' | 'globe' | 'book' | 'wrench' | 'agent' | 'mcp';
  /** 绝对文件路径，read/write/edit 工具才有 */
  filePath?: string;
}

export function describeToolItem(item: ToolItem): ToolDescription {
  switch (item.kind) {
    case 'read':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '读取中' : '已读取',
        target: collapsePath(item.path),
        detail: item.lineCount != null ? `${item.lineCount} lines` : undefined,
        iconType: 'book',
        filePath: item.path,
      };
    case 'write':
      return {
        verb: item.status === 'running' || item.status === 'pending'
          ? (item.isNew ? '创建中' : '写入中')
          : (item.isNew ? '已创建' : '已写入'),
        target: collapsePath(item.path),
        iconType: 'file',
        filePath: item.path,
      };
    case 'edit': {
      const parts: string[] = [];
      if (item.linesAdded) parts.push(`+${item.linesAdded}`);
      if (item.linesDeleted) parts.push(`-${item.linesDeleted}`);
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '编辑中' : '已编辑',
        target: collapsePath(item.path),
        detail: parts.length ? parts.join(' ') : undefined,
        iconType: 'file',
        filePath: item.path,
      };
    }
    case 'exec':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '运行中' : '已运行',
        target: item.command,
        iconType: 'terminal',
      };
    case 'grep':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '搜索中' : '已搜索',
        target: item.path ? `${collapsePath(item.path)} 中的 ${item.pattern}` : item.pattern,
        detail: item.matchCount != null
          ? `${item.matchCount} 处匹配${item.fileCount != null ? `（${item.fileCount} 个文件）` : ''}`
          : undefined,
        iconType: 'search',
      };
    case 'vision':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '查看图片中' : '已查看图片',
        target: collapsePath(item.path),
        detail: item.question || undefined,
        iconType: 'file',
        filePath: item.path,
      };
    case 'glob':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '检索中' : '已检索',
        target: item.pattern,
        detail: item.matchCount != null ? `${item.matchCount} 个文件` : undefined,
        iconType: 'search',
      };
    case 'web_search':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '网页搜索中' : '已搜索网页',
        target: item.query,
        detail: item.resultCount != null ? `${item.resultCount} 个结果` : undefined,
        iconType: 'globe',
      };
    case 'web_fetch':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '获取网页中' : '已获取网页',
        target: item.url,
        detail: item.charCount != null ? `${(item.charCount / 1000).toFixed(1)}k 字符` : undefined,
        iconType: 'globe',
      };
    case 'list_directory':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '列出目录中' : '已列出目录',
        target: collapsePath(item.path),
        detail: item.totalCount != null ? `${item.totalCount} 个条目` : undefined,
        iconType: 'folder',
      };
    case 'ask_user_question':
      return {
        verb: item.status === 'error' ? '问题已失效' : item.status === 'done' ? '已提问' : '提问中',
        target: item.questions?.map(q => q.header).join('， ') ?? '问题',
        iconType: 'check',
      };
    case 'agent': {
      const actionLabels: Record<string, string> = {
        spawn: item.timedOut ? '子 Agent 已转后台运行' : item.status === 'running' || item.status === 'pending' ? '启动子 Agent 中' : '已启动子 Agent',
        wait: item.timedOut ? '等待子 Agent 超时' : '已获取子 Agent 结果',
        send_input: item.status === 'running' || item.status === 'pending' ? '发送子 Agent 消息中' : '已发送子 Agent 消息',
        list: item.status === 'running' || item.status === 'pending' ? '获取子 Agent列表中' : '已获取子 Agent 列表',
        close: item.status === 'running' || item.status === 'pending' ? '关闭子 Agent 中' : '已关闭子 Agent',
      };
      return {
        verb: actionLabels[item.action] ?? '子 Agent',
        target: item.taskName || item.agentId || item.agentIds?.join('， ') || 'agents',
        detail: item.agentStatus ?? (item.agents ? `${item.agents.length} 个 Agent` : undefined),
        iconType: 'agent',
      };
    }
    case 'plan_artifact':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '提交计划中' : '已提交计划',
        target: item.plan?.title ?? item.title ?? '实施计划',
        iconType: 'check',
      };
    case 'tool': {
      if (item.toolName === 'load_skill') {
        let skillName = '';
        try {
          skillName = String((JSON.parse(item.input) as Record<string, unknown>).name ?? '');
        } catch {
          skillName = item.input ?? '';
        }
        return {
          verb: item.status === 'running' || item.status === 'pending' ? '加载技能中' : '已加载技能',
          target: skillName || 'skill',
          iconType: 'wrench',
        };
      }
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '调用工具中' : '已调用工具',
        target: item.toolName,
        detail: item.input ? item.input.slice(0, 80) : undefined,
        iconType: item.toolName.startsWith('mcp__') ? 'mcp' : 'terminal',
      };
    }
    default:
      return {
        verb: item.status === 'running' || item.status === 'pending' ? '运行中' : '已运行',
        target: (item as any).name ?? '工具',
        iconType: 'terminal',
      };
  }
}

/** 将工具函数名映射为 ToolItem.kind */
export function nameToKind(name: string): ToolItem['kind'] {
  switch (name) {
    case 'read_file': return 'read';
    case 'write_file': return 'write';
    case 'edit_file': return 'edit';
    case 'bash_exec': return 'exec';
    case 'grep': return 'grep';
    case 'glob': return 'glob';
    case 'web_search': return 'web_search';
    case 'web_fetch': return 'web_fetch';
    case 'list_directory': return 'list_directory';
    case 'task_create':
    case 'task_get':
    case 'task_list':
    case 'task_update':
    case 'task_output':
    case 'task_stop':
    case 'TaskCreate':
    case 'TaskGet':
    case 'TaskList':
    case 'TaskUpdate':
    case 'TaskOutput':
    case 'TaskStop':
      return 'task';
    case 'update_plan': return 'plan_update';
    case 'submit_plan': return 'plan_artifact';
    case 'ask_user_question': return 'ask_user_question';
    case 'spawn_agent':
    case 'wait_agent':
    case 'send_agent_input':
    case 'list_agents':
    case 'close_agent':
      return 'agent';
    default: return 'tool';
  }
}
