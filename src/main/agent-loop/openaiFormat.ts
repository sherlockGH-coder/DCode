import type { Message, ToolDefinition } from '../../shared/types';

type OpenAIMessage = Record<string, unknown>;

function messageContent(message: Message): unknown {
  return Array.isArray(message.content)
    ? message.content
    : message.content || '';
}

/** Convert the internal history into the Chat Completions message format. */
export function convertMessagesToChatCompletions(messages: Message[]): OpenAIMessage[] {
  return messages.flatMap((message) => {
    if (message.role === 'system') {
      return [{ role: 'system', content: message.content || '' }];
    }

    if (message.role === 'user') {
      return [{ role: 'user', content: messageContent(message) }];
    }

    if (message.role === 'tool') {
      return [{
        role: 'tool',
        tool_call_id: message.tool_call_id || '',
        content: message.content || '',
      }];
    }

    const assistant: OpenAIMessage = {
      role: 'assistant',
      content: message.content || null,
    };
    if (message.tool_calls && message.tool_calls.length > 0) {
      assistant.tool_calls = message.tool_calls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      }));
    }
    // OpenAI-compatible reasoning models commonly expose this extension on
    // assistant messages. Preserve it when replaying history, while keeping
    // the field optional for providers that do not use it.
    if (message.reasoning_content) assistant.reasoning_content = message.reasoning_content;
    return [assistant];
  });
}

/** Convert local function tools to the Chat Completions tool shape. */
export function convertToolsToChatCompletions(tools: ToolDefinition[]): OpenAIMessage[] {
  return tools
    .filter((tool) => !tool.serverTool)
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
        ...(tool.strict === undefined ? {} : { strict: tool.strict }),
      },
    }));
}

export interface ResponsesInput {
  instructions?: string;
  input: OpenAIMessage[];
}

/**
 * Convert the internal history into Responses input items.
 *
 * Responses output items are retained in `providerContentBlocks` and replayed
 * verbatim. This is important for reasoning and function-call items, which
 * cannot be losslessly reconstructed from the flattened renderer message.
 */
export function convertMessagesToResponses(messages: Message[]): ResponsesInput {
  const systemParts: string[] = [];
  const input: OpenAIMessage[] = [];
  const completedFunctionCallIds = new Set(
    messages
      .filter((message) => message.role === 'tool' && message.tool_call_id)
      .map((message) => message.tool_call_id as string),
  );
  const incompleteFunctionCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.providerContentBlocks) continue;
    const functionCallBlocks = message.providerContentBlocks.filter((block) => block.type === 'function_call');
    const hasIncompleteFunctionCall = functionCallBlocks.some((block) => (
      typeof block.call_id !== 'string' || !completedFunctionCallIds.has(block.call_id)
    ));
    if (hasIncompleteFunctionCall) {
      for (const block of functionCallBlocks) {
        if (typeof block.call_id === 'string') incompleteFunctionCallIds.add(block.call_id);
      }
    }
  }

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content || '');
      continue;
    }

    if (message.role === 'user') {
      input.push({ role: 'user', content: messageContent(message) });
      continue;
    }

    if (message.role === 'tool') {
      if (message.tool_call_id && incompleteFunctionCallIds.has(message.tool_call_id)) continue;
      input.push({
        type: 'function_call_output',
        call_id: message.tool_call_id || '',
        output: message.content || '',
      });
      continue;
    }

    if (message.providerContentBlocks && message.providerContentBlocks.length > 0) {
      const hasIncompleteFunctionCall = message.providerContentBlocks.some((block) => (
        block.type === 'function_call' && (
          typeof block.call_id !== 'string' || !completedFunctionCallIds.has(block.call_id)
        )
      ));
      if (hasIncompleteFunctionCall) {
        // Older Responses turns could persist provider function_call blocks
        // before the shared agent loop learned to execute `tool_calls`. Do not
        // replay an incomplete call: the provider rejects it without output.
        if (message.content) input.push({ role: 'assistant', content: message.content });
        continue;
      }
      input.push(...message.providerContentBlocks as OpenAIMessage[]);
      continue;
    }

    if (message.content || !message.tool_calls?.length) {
      input.push({ role: 'assistant', content: message.content || '' });
    }
    for (const toolCall of message.tool_calls ?? []) {
      input.push({
        type: 'function_call',
        call_id: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
    }
  }

  return {
    instructions: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    input,
  };
}

/** Convert local and provider-native tools to Responses tool definitions. */
export function convertToolsToResponses(tools: ToolDefinition[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];
  let addedWebSearch = false;

  for (const tool of tools) {
    if (tool.serverTool) {
      if (!addedWebSearch) {
        result.push({ type: 'web_search_preview' });
        addedWebSearch = true;
      }
      continue;
    }

    result.push({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      ...(tool.strict === undefined ? {} : { strict: tool.strict }),
    });
  }

  return result;
}
