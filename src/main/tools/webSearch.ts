import { ToolExecutor, ToolExecuteResult } from './types';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Web search is now a server-side tool: the model provider API (DeepSeek / Anthropic
 * built-in `web_search` server tool) executes the search and returns an ordered
 * `server_tool_use` + `web_search_tool_result` block pair, so no external search
 * provider or API key is required.
 *
 * This executor is a registry placeholder: the definition tells the model web_search
 * is available, and `convertToolsToAnthropic` maps it to the API's built-in server
 * tool. Server tools never arrive back as local `tool_use` calls, so `execute` is
 * only a defensive fallback.
 */
export const webSearchTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'web_search',
    description:
      `Search the web for current information using the model provider's built-in server-side search. Use for recent docs, events, data, or anything beyond model knowledge; use the current year (${CURRENT_YEAR}) for recent information. The search is executed by the API; the returned snippets are provided to the model automatically. Use web_fetch for full page content. Include relevant Sources in the final answer.`,
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    serverTool: true,
  },

  async execute(_args, _ctx): Promise<ToolExecuteResult> {
    return {
      content: 'Error: web_search is a server-side tool executed by the model provider API and cannot be run locally.',
      error: true,
    };
  },
};
