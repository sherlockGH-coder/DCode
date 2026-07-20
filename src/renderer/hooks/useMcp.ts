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
 * 监听所有 MCP server 状态 + 提供管理操作。
 * projectPath 仅用于 add/update/remove 时透传给主进程，
 * server 列表本身由主进程依据当前 active project 动态维护。
 */
export function useMcp(projectPath: string | null): UseMcpResult {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await window.dcodeApi.mcpListStatus();
      setServers(list);
    } catch (err) {
      console.error('[useMcp] list failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    const unsub = window.dcodeApi.onMcpChanged(() => {
      refresh();
    });
    return unsub;
  }, [refresh]);

  const add = useCallback(
    async (scope: McpScope, name: string, config: McpServerConfig) => {
      return window.dcodeApi.mcpAdd(scope, name, config, projectPath);
    },
    [projectPath],
  );

  const update = useCallback(
    async (scope: McpScope, name: string, config: McpServerConfig) => {
      return window.dcodeApi.mcpUpdate(scope, name, config, projectPath);
    },
    [projectPath],
  );

  const remove = useCallback(
    async (scope: McpScope, name: string) => {
      return window.dcodeApi.mcpRemove(scope, name, projectPath);
    },
    [projectPath],
  );

  const toggle = useCallback(async (scope: McpScope, name: string, enabled: boolean) => {
    return window.dcodeApi.mcpToggle(scope, name, enabled);
  }, []);

  const restart = useCallback(async (scope: McpScope, name: string) => {
    return window.dcodeApi.mcpRestart(scope, name);
  }, []);

  return { servers, isLoading, refresh, add, update, remove, toggle, restart };
}
