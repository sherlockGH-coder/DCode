import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { AgentLoopCallbacks, AgentLoopConfig, Message } from '../shared/types';
import type { ToolExecutionContext, ToolRegistry } from './tools/types';
import { shouldAutoCompact, pruneWithSummary } from './compact';
import { debugLog, logChatEvent } from './logger';
import * as db from './database';
import { getSystemContext, getUserContext, formatSystemContext, formatUserContext, formatTailUserContext } from './context';
import { DEFAULT_BASE_URL, DEFAULT_MAX_AGENT_ROUNDS } from './agent-loop/constants';
import { ensureToolResultPairing } from './agent-loop/messagePairing';
import { executeToolCallsParallel } from './agent-loop/toolExecution';
import { truncateToolResult } from './agent-loop/toolResults';
import { runAnthropicRound } from './agent-loop/anthropicRound';

export { convertMessagesToAnthropic } from './agent-loop/anthropicFormat';

/**
 * Agent Loop 核心函数
 */
export async function agentLoop(
  messages: Message[],
  toolRegistry: ToolRegistry,
  callbacks: AgentLoopCallbacks,
  config: AgentLoopConfig
): Promise<string> {
  const {
    model = 'claude-sonnet-4-6',
    baseUrl = DEFAULT_BASE_URL,
    projectPath = null,
    attachmentWhitelist,
    enabledSkills,
    systemPrompt,
    deepseekMdSources,
    signal,
    conversationId = null,
    turnId,
    attemptNo,
    traceId: providedTraceId,
    approvalWebContentsId,
    reasoningEffort,
    approvalPolicy,
    collaborationMode = 'execute',
    modeRevision,
    toolAccessMode: configuredToolAccessMode,
    subAgent: configuredSubAgent = false,
  } = config;

  const subAgent = configuredSubAgent === true;
  const toolAccessMode = configuredToolAccessMode ?? (subAgent ? 'subagent_readonly' : 'default');
  const traceId = providedTraceId || Math.random().toString(36).slice(2, 8);
  const maxRounds = Number.isFinite(config.maxToolRounds)
    ? Math.max(1, Math.trunc(config.maxToolRounds!))
    : DEFAULT_MAX_AGENT_ROUNDS;
  const log = (...args: unknown[]) => debugLog(`agentLoop ${traceId}`, ...args);
  const logErr = (...args: unknown[]) => console.error(`[agentLoop ${traceId}]`, ...args);

  const whitelistMap = attachmentWhitelist && attachmentWhitelist.length > 0
    ? new Map(attachmentWhitelist.map((a) => [resolve(a.path), a]))
    : undefined;
  const toolCtx: Omit<ToolExecutionContext, 'toolCallId'> = {
    projectPath,
    attachmentWhitelist: whitelistMap,
    traceId,
    conversationId,
    turnId,
    attemptNo,
    approvalWebContentsId,
    approvalPolicy,
    collaborationMode,
    modeRevision,
    subAgent,
    agentRuntime: {
      ...config,
      toolAccessMode,
      subAgent,
      toolRegistry,
    },
  };

  const baseTools = (() => {
    switch (toolAccessMode) {
      case 'subagent_readonly':
        return toolRegistry.getSubAgentReadonlyDefinitions();
      default:
        return toolRegistry.getDefinitionsForMode(collaborationMode);
    }
  })();
  const tools = baseTools;

  let roundCount = 0;
  let finalContent = '';

  let cumulativeCacheHit = 0;
  let cumulativeCacheMiss = 0;

  const workingMessages: Message[] = [];

  const systemContext = getSystemContext(projectPath);

  const userContext = getUserContext({
    deepseekMdSources,
    memoryContext: config.memoryContext,
    enabledSkills,
    mcpInstructions: config.mcpInstructions,
    attachments: whitelistMap ? Array.from(whitelistMap.values()) : undefined,
  });

  const buildRequestMessages = (raw: Message[]): Message[] => {
    const conv = conversationId ? db.getConversationById(conversationId) : null;
    const msgs = pruneWithSummary(raw, conv?.summary, conv?.compacted_to_message_id);

    const systemMessages: Message[] = [];
    const conversationMessages: Message[] = [...msgs];

    if (systemPrompt) {
      systemMessages.push({
        id: 'system_prompt',
        role: 'system',
        content: systemPrompt,
      });
    }

    if (collaborationMode === 'plan') {
      systemMessages.push({
        id: 'plan_mode_instruction',
        role: 'system',
        content: `<plan_mode>
You are in Plan mode for this conversation. Explore and clarify, but do not modify files or application state.
Only the tools exposed in this mode may be used. Never treat the original task as approval.
When the plan is decision-complete, call submit_plan exactly once. It only presents the plan; it never approves or executes it.
After submit_plan, end the turn and wait for a later explicit user decision.
</plan_mode>`,
      });
    }

    const systemContextText = formatSystemContext(systemContext);
    if (systemContextText) {
      systemMessages.push({
        id: 'system_context',
        role: 'system',
        content: systemContextText,
      });
    }

    if (subAgent) {
      systemMessages.push({
        id: 'sub_agent_instruction',
        role: 'system',
        content: `<sub_agent>
You are a read-only exploration sub-agent. Your job is to inspect, analyze, and report findings for the parent agent.

Hard constraints:
- Do not ask the user questions.
- Do not spawn, wait for, message, list, or close other agents.
- Do not run shell commands.
- Do not write, edit, delete, or mutate files or application state.
- Use only read-only tools exposed to you.

Return a concise structured result with:
1. Findings
2. Relevant files or symbols
3. Risks, unknowns, and recommended next steps for the parent agent
</sub_agent>`,
      });
    }

    const userContextText = formatUserContext(userContext);
    if (userContextText) {
      conversationMessages.unshift({
        id: 'user_context_reminder',
        role: 'user',
        content: userContextText,
      });
    }

    const tailContextText = formatTailUserContext(userContext);
    if (tailContextText) {
      conversationMessages.push({
        id: 'tail_context_reminder',
        role: 'user',
        content: tailContextText,
      });
    }

    return [...systemMessages, ...conversationMessages];
  };

  workingMessages.push(...buildRequestMessages(messages));

  log('开始 | model=%s | baseUrl=%s | tools=%d | 附件=%d | skills=%d',
    model, baseUrl, tools.length, whitelistMap?.size ?? 0, enabledSkills?.length ?? 0);

  while (true) {

    if (signal?.aborted) {
      log('⏹ 已中断（轮次开始前）');
      break;
    }

    roundCount++;
    const roundStart = Date.now();
    log(`▶ 第 ${roundCount} 轮 | 消息数=${workingMessages.length}`);

    const pairedMessages = ensureToolResultPairing(workingMessages);
    const roundResult = await runAnthropicRound({
      pairedMessages,
      tools,
      model,
      baseUrl,
      reasoningEffort,
      signal,
      callbacks,
      config,
      traceId,
      conversationId,
      roundCount,
      roundStart,
      finalContent,
      toolRegistry,
      toolCtx,
      log,
      logErr,
    });

    if (roundResult.status === 'return') {
      return roundResult.finalContent;
    }
    if (roundResult.status === 'break') {
      finalContent = roundResult.finalContent;
      break;
    }

    const {
      assistantContent,
      reasoningContent,
      lastUsage,
      stopReason,
      chunkCount,
      toolCalls,
    } = roundResult;

    log(`✓ 本轮完成 | stop_reason=${stopReason ?? 'N/A'} | chunks=${chunkCount} | 文本=${assistantContent.length}字 | 思维=${reasoningContent.length}字 | 耗时=${Date.now() - roundStart}ms`);

    logChatEvent('round_response', {
      traceId,
      conversationId,
      round: roundCount,
      finishReason: stopReason ?? null,
      chunkCount,
      assistantContentLength: assistantContent.length,
      reasoningContentLength: reasoningContent.length,
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
      })),
      usage: lastUsage,
      durationMs: Date.now() - roundStart,
    });

    if (lastUsage) {
      const hitTokens = lastUsage.prompt_cache_hit_tokens ?? 0;
      const missTokens = lastUsage.prompt_cache_miss_tokens ?? 0;
      cumulativeCacheHit += hitTokens;
      cumulativeCacheMiss += missTokens;
      if (callbacks.onCacheMetrics) {
        callbacks.onCacheMetrics({
          hitTokens,
          missTokens,
          cumulativeHit: cumulativeCacheHit,
          cumulativeMiss: cumulativeCacheMiss,
        });
      }
      if (hitTokens > 0 || missTokens > 0) {
        const total = cumulativeCacheHit + cumulativeCacheMiss;
        const rate = total > 0 ? ((cumulativeCacheHit / total) * 100).toFixed(1) : '0.0';
        log(`💰 缓存: 本轮 hit=${hitTokens} miss=${missTokens} | 累计 hit=${cumulativeCacheHit} miss=${cumulativeCacheMiss} | 命中率=${rate}%`);
      }
    }

    if (stopReason === 'tool_use' && toolCalls.length > 0) {
      log(`收到工具调用 ${toolCalls.length} 个: [${toolCalls.map(t => t.function.name).join(', ')}]`);

      const assistantMessage: Message = {
        id: randomUUID(),
        role: 'assistant',
        content: assistantContent || '',
        tool_calls: toolCalls,
        usage: lastUsage,
        duration: Date.now() - roundStart,
        completed_at: Date.now(),
      };
      if (reasoningContent) {
        assistantMessage.reasoning_content = reasoningContent;
      }
      workingMessages.push(assistantMessage);
      callbacks.onAssistantMessage?.(assistantMessage);

      const toolResults = await executeToolCallsParallel(
        toolCalls, toolRegistry, toolCtx, callbacks, signal, log,
        traceId, conversationId, roundCount,
      );

      for (const { toolCall, result } of toolResults) {
        const truncatedContent = truncateToolResult(result.content, toolCall.function.name);
        const toolMessage: Message = {
          id: randomUUID(),
          role: 'tool',
          content: truncatedContent,
          contentBlocks: result.contentBlocks,
          tool_call_id: result.tool_call_id,
          name: result.name,
        };
        if (result.metadata) toolMessage.metadata = result.metadata;
        if (result.error) toolMessage.error = true;
        workingMessages.push(toolMessage);
        callbacks.onToolMessage?.(toolMessage);
      }

      if (toolResults.some(({ result }) => result.terminal === true)) {
        finalContent = assistantContent;
        break;
      }

      if (lastUsage?.prompt_tokens && shouldAutoCompact(lastUsage.prompt_tokens)) {
        log('Auto-compact triggered: prompt_tokens=%d', lastUsage.prompt_tokens);
        if (callbacks.onAutoCompact) {
          try {
            const freshMessages = await callbacks.onAutoCompact();
            if (freshMessages && freshMessages.length > 0) {

              const rebuilt = buildRequestMessages(freshMessages);
              workingMessages.length = 0;
              workingMessages.push(...rebuilt);
              log('Auto-compact complete: new message count=%d', workingMessages.length);
            }
          } catch (err) {
            logErr('Auto-compact failed (non-fatal):', err);
          }
        }
      }

      continue;
    }

    finalContent = assistantContent;
    if (finalContent || reasoningContent) {
      const finalMessage: Message = {
        id: randomUUID(),
        role: 'assistant',
        content: finalContent,
        usage: lastUsage,
        duration: Date.now() - roundStart,
        completed_at: Date.now(),
      };
      if (reasoningContent) finalMessage.reasoning_content = reasoningContent;
      callbacks.onAssistantMessage?.(finalMessage);
    }
    break;
  }

  log(`■ 结束 | 总轮次=${roundCount} | 最终输出=${finalContent.length}字${signal?.aborted ? ' | 被中断' : ''}`);

  logChatEvent('chat_done', {
    traceId,
    conversationId,
    totalRounds: roundCount,
    finalContentLength: finalContent.length,
    aborted: !!signal?.aborted,
  });

  callbacks.onDone(finalContent);
  return finalContent;
}
