import { ipcRenderer } from 'electron';
import type { McpScope, McpServerConfig, McpServerStatus } from '../../shared/types';
import { subscribe } from '../bridge';

export const mcpApi = {
  /** 列出所有 MCP server 状态（含配置 / 状态 / 暴露的工具） */
  mcpListStatus: (): Promise<McpServerStatus[]> => {
    return ipcRenderer.invoke('mcp:listStatus');
  },

  /** 添加 MCP server */
  mcpAdd: (
    scope: McpScope,
    name: string,
    config: McpServerConfig,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:add', scope, name, config, projectPath);
  },

  /** 更新 MCP server */
  mcpUpdate: (
    scope: McpScope,
    name: string,
    config: McpServerConfig,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:update', scope, name, config, projectPath);
  },

  /** 删除 MCP server */
  mcpRemove: (
    scope: McpScope,
    name: string,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:remove', scope, name, projectPath);
  },

  /** 启用 / 禁用 MCP server */
  mcpToggle: (scope: McpScope, name: string, enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:toggle', scope, name, enabled);
  },

  /** 重启 MCP server */
  mcpRestart: (scope: McpScope, name: string): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:restart', scope, name);
  },

  /** 订阅 MCP 状态变更 */
  onMcpChanged: (callback: () => void): (() => void) => {
    return subscribe('mcp:changed', callback);
  },
};
