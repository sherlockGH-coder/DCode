import type { ToolExecutor, ToolExecuteResult } from '../tools/types';
import type { McpClient, McpToolFull } from './client';

export function bridgeMcpTool(client: McpClient, tool: McpToolFull): ToolExecutor {
  return {

    isConcurrencySafe: tool.annotations?.readOnlyHint === true,
    isReadonly: tool.annotations?.readOnlyHint === true,
    definition: {
      name: tool.namespacedName,
      description: tool.description
        ? `[${client.serverName}] ${tool.description}`
        : `[${client.serverName}] ${tool.name}`,
      input_schema: tool.inputSchema,
    },
    async execute(args, ctx): Promise<ToolExecuteResult> {
      try {
        const r = await client.callTool(tool.name, args, ctx.signal);
        return {
          content: r.text,
          error: r.isError,
        };
      } catch (err) {
        if (ctx.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return {
            content: '[Aborted] 用户中止了执行',
            error: true,
          };
        }
        return {
          content: `[MCP] ${client.serverName}/${tool.name} 调用失败：${err instanceof Error ? err.message : String(err)}`,
          error: true,
        };
      }
    },
  };
}
