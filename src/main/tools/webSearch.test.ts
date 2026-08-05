import { describe, expect, it } from 'vitest';

import { webSearchTool } from './webSearch';
import type { ToolExecutionContext } from './types';

function context(): ToolExecutionContext {
  return {
    projectPath: null,
    toolCallId: 'call_web_search',
  };
}

describe('web_search tool', () => {
  it('declares a server-side tool without any external search provider', () => {
    expect(webSearchTool.definition.name).toBe('web_search');
    expect(webSearchTool.definition.serverTool).toBe(true);
    expect(webSearchTool.definition.description).toContain('built-in server-side search');
    expect(webSearchTool.definition.description).toContain('Include relevant Sources');
    expect(webSearchTool.definition.description).not.toContain('Tavily');
  });

  it('exposes an empty input schema because the API executes the search', () => {
    expect(webSearchTool.definition.input_schema).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
  });

  it('is read-only and concurrency-safe', () => {
    expect(webSearchTool.isReadonly).toBe(true);
    expect(webSearchTool.isConcurrencySafe).toBe(true);
  });

  it('returns a defensive error if executed locally', async () => {
    const result = await webSearchTool.execute({}, context());
    expect(result.error).toBe(true);
    expect(result.content).toContain('server-side tool');
  });
});
