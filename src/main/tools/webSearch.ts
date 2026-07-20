import { ToolExecutor, ToolExecuteResult } from './types';
import { settingsManager } from '../settings';
import { mergeAbortSignals } from '../agent-loop/signals';
import { debugLog } from '../logger';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS = 10;
const CURRENT_YEAR = new Date().getFullYear();

function stringArrayArg(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return items.length > 0 ? items : undefined;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_RESULTS, Math.max(1, Math.trunc(value)))
    : fallback;
}

export const webSearchTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'web_search',
    description:
      `Search the web for current information via Tavily. Use for recent docs, events, data, or anything beyond model knowledge. Queries should be clear and self-contained; use the current year (${CURRENT_YEAR}) for recent information. Returns titles, URLs, and snippets; use web_fetch for full page content. Include relevant Sources in the final answer. Domain filters are supported, but do not set both allowed_domains and blocked_domains.`,
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 2,
          description: 'Search query to run.',
        },
        allowed_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only include results from these domains.',
        },
        blocked_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude results from these domains.',
        },
        max_results: {
          type: 'number',
          minimum: 1,
          maximum: MAX_RESULTS,
          description: `Maximum results to return. Defaults to ${DEFAULT_MAX_RESULTS}.`,
          default: DEFAULT_MAX_RESULTS,
        },
        search_depth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Tavily search depth. Use advanced for harder or broader research.',
          default: 'basic',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const maxResults = numberArg(args.max_results, DEFAULT_MAX_RESULTS);
    const searchDepth = (args.search_depth as 'basic' | 'advanced') ?? 'basic';
    const allowedDomains = stringArrayArg(args.allowed_domains);
    const blockedDomains = stringArrayArg(args.blocked_domains);
    debugLog('tool', 'web_search:', query);

    if (query.length < 2) {
      return { content: 'Error: web_search requires a query with at least 2 characters.', error: true };
    }

    if (allowedDomains?.length && blockedDomains?.length) {
      return {
        content: 'Error: web_search cannot use allowed_domains and blocked_domains in the same request.',
        error: true,
      };
    }

    const apiKey = settingsManager.getTavilyApiKey();
    if (!apiKey) {
      return {
        content: 'Error: Tavily API Key is not configured. Configure it in Settings -> Web Search.\nGet a key: https://tavily.com',
        error: true,
      };
    }

    try {
      const body: Record<string, unknown> = {
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        include_answer: false,
        max_results: maxResults,
      };
      if (allowedDomains) body.include_domains = allowedDomains;
      if (blockedDomains) body.exclude_domains = blockedDomains;

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: mergeAbortSignals(ctx.signal, AbortSignal.timeout(15000)),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Tavily API request failed (${response.status}): ${text.slice(0, 200)}`);
      }

      const data: TavilyResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        return {
          content: `No web search results found for "${query}".`,
          metadata: { kind: 'web_search', query, resultCount: 0 },
        };
      }

      const lines = data.results.map((r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n   URL: ${r.url}\n   Snippet: ${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`
      );

      return {
        content: `Web search results for query: "${query}"\n\n${lines.join('\n\n')}\n\nREMINDER: Include relevant sources above in the final response using markdown hyperlinks.`,
        metadata: { kind: 'web_search', query, resultCount: data.results.length },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`Search failed: ${error}`);
    }
  },
};
