import { ipcRenderer } from 'electron';
import type { PendingApprovalRequest } from '../../shared/types';
import { subscribe } from '../bridge';

export const approvalApi = {
  /** Subscribe to approval requests emitted before sensitive tools such as bash_exec run. */
  onApprovalRequest: (
    callback: (req: PendingApprovalRequest) => void,
  ) => {
    return subscribe('tool:approval-request', callback);
  },

  /** Get approvals still waiting for a user decision, used to restore UI after HMR or renderer remount. */
  approvalListPending: (conversationId?: string | null): Promise<PendingApprovalRequest[]> => {
    return ipcRenderer.invoke('approval:listPending', conversationId);
  },

  /**
   * Submit an approval decision.
   * @param rememberForSession - true when the user selects "Allow for this session".
   * @param scope - Object covered by "Allow for this session"; currently only outOfScopeDir.
   * @param answers - Answer mapping for AskUserQuestion.
   */
  approvalRespond: (
    toolCallId: string,
    allowed: boolean,
    reason?: string,
    rememberForSession?: boolean,
    scope?: { kind: 'outOfScopeDir'; dir: string },
    answers?: Record<string, string>,
  ) => {
    return ipcRenderer.invoke(
      'approval:respond',
      toolCallId,
      allowed,
      reason,
      rememberForSession,
      scope,
      answers,
    );
  },
};
