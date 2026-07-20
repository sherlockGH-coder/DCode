import type { AgentLoopCallbacks, AgentLoopConfig, Message, ToolCall } from '../../shared/types';
import type { ToolExecutionContext, ToolRegistry } from '../tools/types';

export interface RoundRunnerParams {
  pairedMessages: Message[];
  tools: any[];
  model: string;
  baseUrl: string;
  reasoningEffort?: string;
  signal?: AbortSignal;
  callbacks: AgentLoopCallbacks;
  config: AgentLoopConfig;
  traceId: string;
  conversationId: string | null;
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
    }
  | {
      status: 'break';
      finalContent: string;
    }
  | {
      status: 'return';
      finalContent: string;
    };
