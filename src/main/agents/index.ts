import { ipcMain } from 'electron';
import { IPC_EVENTS } from '../../shared/types';
import { subAgentManager } from './manager';

export { subAgentManager };
export { SubAgentManager } from './manager';
export type { SpawnAgentInput, SubAgentRuntime } from './manager';

export function registerAgentsIpc(): void {
  ipcMain.handle(IPC_EVENTS.AGENTS_LIST, () => {
    return subAgentManager.list();
  });
}
