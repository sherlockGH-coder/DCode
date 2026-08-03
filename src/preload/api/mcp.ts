import { ipcRenderer } from 'electron';
import type { McpScope, McpServerConfig, McpServerStatus } from '../../shared/types';
import { subscribe } from '../bridge';

export const mcpApi = {
  /** List all MCP server states, including configuration, status, and exposed tools. */
  mcpListStatus: (): Promise<McpServerStatus[]> => {
    return ipcRenderer.invoke('mcp:listStatus');
  },

  /** Add an MCP server. */
  mcpAdd: (
    scope: McpScope,
    name: string,
    config: McpServerConfig,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:add', scope, name, config, projectPath);
  },

  /** Update an MCP server. */
  mcpUpdate: (
    scope: McpScope,
    name: string,
    config: McpServerConfig,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:update', scope, name, config, projectPath);
  },

  /** Delete an MCP server. */
  mcpRemove: (
    scope: McpScope,
    name: string,
    projectPath: string | null,
  ): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:remove', scope, name, projectPath);
  },

  /** Enable or disable an MCP server. */
  mcpToggle: (scope: McpScope, name: string, enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:toggle', scope, name, enabled);
  },

  /** Restart an MCP server. */
  mcpRestart: (scope: McpScope, name: string): Promise<boolean> => {
    return ipcRenderer.invoke('mcp:restart', scope, name);
  },

  /** Subscribe to MCP state changes. */
  onMcpChanged: (callback: () => void): (() => void) => {
    return subscribe('mcp:changed', callback);
  },
};
