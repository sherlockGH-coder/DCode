import type { AgentLoopCallbacks, AgentLoopConfig, Message, ProviderContentBlock, ServerToolUse, ToolCall } from '../../shared/types';
import type { ToolExecutionContext, ToolRegistry } from '../tools/types';

export interface RoundRunnerParams {
  pairedMessages: Message[];
  tools: any[];
  model: string;
  baseUrl: string;
  protocol?: import('../../shared/types').ApiProtocol;
  reasoningEffort?: string;
  signal?: AbortSignal;
  callbacks: AgentLoopCallbacks;
  config: AgentLoopConfig;
  roundCount: number;
  roundStart: number;
  finalContent: string;
  toolRegistry: ToolRegistry;
  toolCtx: Omit<ToolExecutionContext, 'toolCallId'>;
  log: (...args: unknown[]) => void;
  logErr: (...args: unknown[]) => void;
}

export type RoundRunnerResult =
  | {
      status: 'ok';
      assistantContent: string;
      reasoningContent: string;
      lastUsage: any;
      stopReason: string | undefined;
      chunkCount: number;
      toolCalls: ToolCall[];
      /** Server-side tool uses (for example web search) executed by the API in this round. */
      serverToolUses?: ServerToolUse[];
      /** Complete ordered assistant blocks returned by the provider. */
      providerContentBlocks?: ProviderContentBlock[];
    }
  | {
      status: 'break';
      finalContent: string;
    }
  | {
      status: 'return';
      finalContent: string;
    };
