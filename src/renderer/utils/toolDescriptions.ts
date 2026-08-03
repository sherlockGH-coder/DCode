import type { ToolItem } from '../../shared/types';
import { collapsePath } from './collapsePath';

interface ToolDescription {
  /** Action verb rendered in sans-serif ("Ran" / "Reading" / "Finding files:"). */
  verb: string;
  /** Variable content such as commands, paths, and patterns, rendered in monospace. */
  target: string;
  /** Optional detail such as "120 lines" or "+3 -1". */
  detail?: string;
  /** Icon type identifier mapped to a concrete icon component by the renderer. */
  iconType: 'file' | 'folder' | 'terminal' | 'search' | 'check' | 'globe' | 'book' | 'wrench' | 'agent' | 'mcp';
  /** Absolute file path, present only for read/write/edit tools. */
  filePath?: string;
}

export function describeToolItem(item: ToolItem): ToolDescription {
  switch (item.kind) {
    case 'read':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Reading' : 'Read',
        target: collapsePath(item.path),
        detail: item.lineCount != null ? `${item.lineCount} lines` : undefined,
        iconType: 'book',
        filePath: item.path,
      };
    case 'write':
      return {
        verb: item.status === 'running' || item.status === 'pending'
          ? (item.isNew ? 'Creating' : 'Writing')
          : (item.isNew ? 'Created' : 'Written'),
        target: collapsePath(item.path),
        iconType: 'file',
        filePath: item.path,
      };
    case 'edit': {
      const parts: string[] = [];
      if (item.linesAdded) parts.push(`+${item.linesAdded}`);
      if (item.linesDeleted) parts.push(`-${item.linesDeleted}`);
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Editing' : 'Edited',
        target: collapsePath(item.path),
        detail: parts.length ? parts.join(' ') : undefined,
        iconType: 'file',
        filePath: item.path,
      };
    }
    case 'exec':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Running' : 'Ran',
        target: item.command,
        iconType: 'terminal',
      };
    case 'grep':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Searching' : 'Searched',
        target: item.path ? `${item.pattern} in ${collapsePath(item.path)}` : item.pattern,
        detail: item.matchCount != null
          ? `${item.matchCount} matches${item.fileCount != null ? ` in ${item.fileCount} files` : ''}`
          : undefined,
        iconType: 'search',
      };
    case 'vision':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Viewing image' : 'Viewed image',
        target: collapsePath(item.path),
        detail: item.question || undefined,
        iconType: 'file',
        filePath: item.path,
      };
    case 'glob':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Finding files' : 'Found files',
        target: item.pattern,
        detail: item.matchCount != null ? `${item.matchCount} files` : undefined,
        iconType: 'search',
      };
    case 'web_search':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Searching web' : 'Searched web',
        target: item.query,
        detail: item.resultCount != null ? `${item.resultCount} results` : undefined,
        iconType: 'globe',
      };
    case 'web_fetch':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Fetching webpage' : 'Fetched webpage',
        target: item.url,
        detail: item.charCount != null ? `${(item.charCount / 1000).toFixed(1)}k chars` : undefined,
        iconType: 'globe',
      };
    case 'list_directory':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Listing directory' : 'Listed directory',
        target: collapsePath(item.path),
        detail: item.totalCount != null ? `${item.totalCount} entries` : undefined,
        iconType: 'folder',
      };
    case 'ask_user_question':
      return {
        verb: item.status === 'error' ? 'Question expired' : item.status === 'done' ? 'Asked' : 'Asking',
        target: item.questions?.map(q => q.header).join(', ') ?? 'Question',
        iconType: 'check',
      };
    case 'agent': {
      const actionLabels: Record<string, string> = {
        spawn: item.timedOut ? 'Sub-agent moved to background' : item.status === 'running' || item.status === 'pending' ? 'Starting sub-agent' : 'Started sub-agent',
        wait: item.timedOut ? 'Sub-agent wait timed out' : 'Received sub-agent result',
        send_input: item.status === 'running' || item.status === 'pending' ? 'Sending sub-agent message' : 'Sent sub-agent message',
        list: item.status === 'running' || item.status === 'pending' ? 'Listing sub-agents' : 'Listed sub-agents',
        close: item.status === 'running' || item.status === 'pending' ? 'Closing sub-agent' : 'Closed sub-agent',
      };
      return {
        verb: actionLabels[item.action] ?? 'Sub-agent',
        target: item.taskName || item.agentId || item.agentIds?.join(', ') || 'agents',
        detail: item.agentStatus ?? (item.agents ? `${item.agents.length} agents` : undefined),
        iconType: 'agent',
      };
    }
    case 'plan_artifact':
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Submitting plan' : 'Submitted plan',
        target: item.plan?.title ?? item.title ?? 'Implementation plan',
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
          verb: item.status === 'running' || item.status === 'pending' ? 'Loading skill' : 'Loaded skill',
          target: skillName || 'skill',
          iconType: 'wrench',
        };
      }
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Calling tool' : 'Called tool',
        target: item.toolName,
        detail: item.input ? item.input.slice(0, 80) : undefined,
        iconType: item.toolName.startsWith('mcp__') ? 'mcp' : 'terminal',
      };
    }
    default:
      return {
        verb: item.status === 'running' || item.status === 'pending' ? 'Running' : 'Ran',
        target: (item as any).name ?? 'Tool',
        iconType: 'terminal',
      };
  }
}

/** Map a tool function name to its ToolItem kind. */
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
