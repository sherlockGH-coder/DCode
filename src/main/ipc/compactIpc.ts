import { ipcMain } from 'electron';
import { compactConversation } from '../compact';
import { IPC_EVENTS } from '../../shared/types';

export function registerCompactIpc(): void {
  ipcMain.handle(IPC_EVENTS.COMPACT_RUN, async (_event, conversationId: string) => {
    return compactConversation(conversationId);
  });
}
