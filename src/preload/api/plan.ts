import { ipcRenderer } from 'electron';
import type {
  ConversationModeState,
  MarkPlanPresentedRequest,
  PlanArtifact,
  PlanDecisionRequest,
  PlanDecisionResult,
  PlanPresentationToken,
  SetConversationModeRequest,
} from '../../shared/types';
import { IPC_EVENTS } from '../../shared/types';
import { subscribe } from '../bridge';

export const planApi = {
  getConversationModeState: (conversationId: string): Promise<ConversationModeState> => (
    ipcRenderer.invoke('chat:get-mode-state', conversationId)
  ),
  setConversationMode: (request: SetConversationModeRequest): Promise<ConversationModeState> => (
    ipcRenderer.invoke('chat:set-mode', request)
  ),
  markPlanPresented: (request: MarkPlanPresentedRequest): Promise<PlanPresentationToken> => (
    ipcRenderer.invoke('plan:mark-presented', request)
  ),
  getPlanArtifact: (planId: string): Promise<PlanArtifact | null> => (
    ipcRenderer.invoke('plan:get', planId)
  ),
  decidePlan: (request: PlanDecisionRequest): Promise<PlanDecisionResult> => (
    ipcRenderer.invoke('plan:decide', request)
  ),
  onConversationModeStateChanged: (callback: (state: ConversationModeState) => void) => (
    subscribe(IPC_EVENTS.CHAT_MODE_STATE_CHANGED, callback)
  ),
};
