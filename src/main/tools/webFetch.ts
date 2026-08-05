import { ToolExecutor, ToolExecuteResult } from './types';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { mergeAbortSignals } from '../agent-loop/signals';
import { debugLog } from '../debug';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const MAX_CONTENT_CHARS = 50000;

type WebFetchProvider = 'local' | 'jina';

interface ExtractedPage {
  title: string;
  content: string;
  provider: WebFetchProvider;
}

function normalizeFetchUrl(rawUrl: string): { url: string } | { error: string } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: `Invalid URL protocol: ${parsed.protocol}` };
    }
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    return { url: parsed.toString() };
  } catch {
    return { error: `Invalid URL: ${rawUrl}` };
  }
}

function formatFetchedContent(page: ExtractedPage, url: string, prompt: string): string {
  const title = page.title ? `# ${page.title}\n\n` : '';
  const markdown = `${title}${page.content}`;
  const truncated = markdown.length > MAX_CONTENT_CHARS
    ? `${markdown.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated due to length.]`
    : markdown;

  return `Web page: ${url}
Prompt: ${prompt}

Use only the fetched content below to answer the prompt.

---
${truncated}`;
}

async function extractLocally(url: string, signal?: AbortSignal): Promise<ExtractedPage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeepSeekApp/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: mergeAbortSignals(signal, AbortSignal.timeout(15000)),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;

    const html = await response.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.content || !article.textContent || article.textContent.trim().length < 100) return null;

    const markdown = turndown.turndown(article.content);
    return { title: article.title || '', content: markdown, provider: 'local' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

async function extractViaJina(url: string, signal?: AbortSignal): Promise<ExtractedPage | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown' },
      signal: mergeAbortSignals(signal, AbortSignal.timeout(20000)),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const text = await response.text();
    if (text.trim().length < 100) return null;

    const lines = text.split('\n');
    const title = lines[0]?.replace(/^#+\s*/, '').trim() || '';

    return { title, content: text, provider: 'jina' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

export const webFetchTool: ToolExecutor = {
  isConcurrencySafe: true,
  isReadonly: true,
  definition: {
    name: 'web_fetch',
    description:
      'Fetch a fully formed URL and return page content for a specific prompt. Use after web_search when you need details from a page. The prompt must say what to extract or analyze. Authenticated/private and JavaScript-heavy pages may fail; large pages may be truncated. HTTP URLs are upgraded to HTTPS. Backend priority: local Readability -> Jina Reader.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Fully formed URL to fetch.',
        },
        prompt: {
          type: 'string',
          description: 'What to extract, summarize, or answer from the fetched page.',
        },
      },
      required: ['url', 'prompt'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const rawUrl = typeof args.url === 'string' ? args.url.trim() : '';
    const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
    debugLog('tool', 'web_fetch:', rawUrl);

    const normalized = normalizeFetchUrl(rawUrl);
    if ('error' in normalized) {
      return { content: normalized.error, error: true };
    }
    if (prompt.length === 0) {
      return { content: 'Error: web_fetch requires a prompt describing what to extract from the page.', error: true };
    }

    const { url } = normalized;

    const local = await extractLocally(url, ctx.signal);
    if (local) {
      return {
        content: formatFetchedContent(local, url, prompt),
        metadata: { kind: 'web_fetch', url, title: local.title, charCount: local.content.length, provider: local.provider },
      };
    }

    const jina = await extractViaJina(url, ctx.signal);
    if (jina) {
      return {
        content: formatFetchedContent(jina, url, prompt),
        metadata: { kind: 'web_fetch', url, title: jina.title, charCount: jina.content.length, provider: jina.provider },
      };
    }

    return {
      content: `Unable to fetch page content. The page may require JavaScript, authentication, or the server may have denied access.\nURL: ${url}`,
      error: true,
    };
  },
};
