import { ipcMain } from 'electron';
import { mcpManager } from './manager';
import { resolveKnownProjectPath } from '../projectScope';
import type { McpScope, McpServerConfig } from '../../shared/types';

export { mcpManager } from './manager';

export function registerMcpIpc(): void {
  ipcMain.handle('mcp:listStatus', () => {
    return mcpManager.getStatusList();
  });

  ipcMain.handle(
    'mcp:add',
    (_e, scope: McpScope, name: string, config: McpServerConfig, projectPath: string | null) => {
      return mcpManager.addServer(scope, name, config, resolveScopeProjectPath(scope, projectPath));
    },
  );

  ipcMain.handle(
    'mcp:update',
    (_e, scope: McpScope, name: string, config: McpServerConfig, projectPath: string | null) => {
      return mcpManager.updateServer(scope, name, config, resolveScopeProjectPath(scope, projectPath));
    },
  );

  ipcMain.handle(
    'mcp:remove',
    (_e, scope: McpScope, name: string, projectPath: string | null) => {
      return mcpManager.removeServer(scope, name, resolveScopeProjectPath(scope, projectPath));
    },
  );

  ipcMain.handle(
    'mcp:toggle',
    (_e, scope: McpScope, name: string, enabled: boolean) => {
      return mcpManager.toggleServer(scope, name, enabled);
    },
  );

  ipcMain.handle('mcp:restart', (_e, scope: McpScope, name: string) => {
    return mcpManager.restartServer(scope, name);
  });

}

function resolveScopeProjectPath(scope: McpScope, projectPath: string | null): string | null {
  return scope === 'project' ? resolveKnownProjectPath(projectPath) : null;
}
