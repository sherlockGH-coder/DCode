import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../../shared/types';

/**
 * Convert the internal Message format to Anthropic message format.
 *
 * Anthropic message format:
 * - the system prompt is a separate parameter, not part of messages;
 * - user messages: { role: 'user', content: string | ContentBlock[] };
 * - assistant messages: { role: 'assistant', content: ContentBlock[] };
 * - tool results: { role: 'user', content: [{ type: 'tool_result', tool_use_id, content }] }.
 */
export function convertMessagesToAnthropic(messages: Message[]): {
  systemPrompt: Anthropic.TextBlockParam[];
  anthropicMessages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const anthropicMessages: Anthropic.MessageParam[] = [];

  let pendingToolResults: Anthropic.ToolResultBlockParam[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      anthropicMessages.push({
        role: 'user',
        content: [...pendingToolResults],
      });
      pendingToolResults = [];
    }
  };

  for (const msg of messages) {

    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }

    if (msg.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: msg.tool_call_id || '',
        content: msg.contentBlocks && msg.contentBlocks.length > 0
          ? msg.contentBlocks
          : msg.content || '',
        ...(msg.error ? { is_error: true } : {}),
      });
      continue;
    }

    flushToolResults();

    if (msg.role === 'user') {

      if (Array.isArray(msg.content as any)) {
        anthropicMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.id === 'user_context_reminder' || msg.id === 'tail_context_reminder') {
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'text' as const,
            text: msg.content || '',
          }],
        });
      } else {
        anthropicMessages.push({
          role: 'user',
          content: msg.content || '',
        });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      const contentBlocks: Anthropic.ContentBlockParam[] = [];

      if (msg.reasoning_content) {
        contentBlocks.push({
          type: 'thinking',
          thinking: msg.reasoning_content,
          signature: '',
        });
      }

      if (msg.content) {
        contentBlocks.push({
          type: 'text',
          text: msg.content,
        });
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments);
          } catch {}
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }

      if (contentBlocks.length === 0) {
        contentBlocks.push({ type: 'text', text: '' });
      }

      anthropicMessages.push({
        role: 'assistant',
        content: contentBlocks,
      });
      continue;
    }
  }

  flushToolResults();

  const systemBlocks: Anthropic.TextBlockParam[] = systemParts.map((text) => ({
    type: 'text' as const,
    text,
  }));
  return {
    systemPrompt: systemBlocks,
    anthropicMessages,
  };
}

/**
 * Convert internal tool definitions to Anthropic format.
 */
export function convertToolsToAnthropic(tools: any[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
