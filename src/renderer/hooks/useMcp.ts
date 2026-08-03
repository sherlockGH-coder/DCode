import { useState, useEffect, useCallback } from 'react';
import type { McpScope, McpServerConfig, McpServerStatus } from '../../shared/types';

interface UseMcpResult {
  servers: McpServerStatus[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  add: (scope: McpScope, name: string, config: McpServerConfig) => Promise<boolean>;
  update: (scope: McpScope, name: string, config: McpServerConfig) => Promise<boolean>;
  remove: (scope: McpScope, name: string) => Promise<boolean>;
  toggle: (scope: McpScope, name: string, enabled: boolean) => Promise<boolean>;
  restart: (scope: McpScope, name: string) => Promise<boolean>;
}

/**
 * Listen to all MCP server states and provide management operations.
 * projectPath is forwarded to the main process only for add/update/remove.
 * The server list itself is maintained dynamically by the main process for the active project.
 */
export function useMcp(projectPath: string | null): UseMcpResult {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await window.deepseekApi.mcpListStatus();
      setServers(list);
    } catch (err) {
      console.error('[useMcp] list failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
    const unsub = window.deepseekApi.onMcpChanged(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  const add = useCallback(
    async (scope: McpScope, name: string, config: McpServerConfig) => {
      return window.deepseekApi.mcpAdd(scope, name, config, projectPath);
    },
    [projectPath],
  );

  const update = useCallback(
    async (scope: McpScope, name: string, config: McpServerConfig) => {
      return window.deepseekApi.mcpUpdate(scope, name, config, projectPath);
    },
    [projectPath],
  );

  const remove = useCallback(
    async (scope: McpScope, name: string) => {
      return window.deepseekApi.mcpRemove(scope, name, projectPath);
    },
    [projectPath],
  );

  const toggle = useCallback(async (scope: McpScope, name: string, enabled: boolean) => {
    return window.deepseekApi.mcpToggle(scope, name, enabled);
  }, []);

  const restart = useCallback(async (scope: McpScope, name: string) => {
    return window.deepseekApi.mcpRestart(scope, name);
  }, []);

  return { servers, isLoading, refresh, add, update, remove, toggle, restart };
}
