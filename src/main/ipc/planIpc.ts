import { BrowserWindow, ipcMain } from 'electron';
import { IPC_EVENTS } from '../../shared/types';
import type {
  MarkPlanPresentedRequest,
  PlanDecisionRequest,
  SetConversationModeRequest,
} from '../../shared/types';
import { settingsManager } from '../settings';
import {
  decidePlan,
  getConversationModeState,
  getPlanArtifact,
  markPlanPresented,
  setConversationMode,
} from '../plan/planService';

export function broadcastConversationModeState(conversationId: string): void {
  const state = getConversationModeState(conversationId);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC_EVENTS.CHAT_MODE_STATE_CHANGED, state);
  }
}

export function registerPlanIpc(): void {
  ipcMain.handle('chat:get-mode-state', (_event, conversationId: string) => (
    getConversationModeState(conversationId)
  ));
  ipcMain.handle('chat:set-mode', (_event, request: SetConversationModeRequest) => {
    const state = setConversationMode(request);
    broadcastConversationModeState(request.conversationId);
    return state;
  });
  ipcMain.handle('plan:get', (_event, planId: string) => (
    getPlanArtifact(planId)
  ));
  ipcMain.handle('plan:mark-presented', (event, request: MarkPlanPresentedRequest) => (
    markPlanPresented(request, event.sender.id)
  ));
  ipcMain.handle('plan:decide', (event, request: PlanDecisionRequest) => {
    if (request.decision === 'approve') settingsManager.assertActiveApiProfileSupported();
    const result = decidePlan(request, event.sender.id);
    broadcastConversationModeState(request.conversationId);
    return result;
  });
}
