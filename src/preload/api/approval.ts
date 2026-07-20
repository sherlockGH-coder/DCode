import { ipcRenderer } from 'electron';
import type { PendingApprovalRequest } from '../../shared/types';
import { subscribe } from '../bridge';

export const approvalApi = {
  /** 订阅审批请求（bash_exec 等敏感工具执行前会发） */
  onApprovalRequest: (
    callback: (req: PendingApprovalRequest) => void,
  ) => {
    return subscribe('tool:approval-request', callback);
  },

  /** 获取仍在等待用户决策的审批请求，用于 HMR / renderer 重挂载后恢复 UI */
  approvalListPending: (conversationId?: string | null): Promise<PendingApprovalRequest[]> => {
    return ipcRenderer.invoke('approval:listPending', conversationId);
  },

  /**
   * 提交审批决策
   * @param rememberForSession - 用户勾选「本会话允许」时为 true
   * @param scope - 「本会话允许」的对象，目前仅 outOfScopeDir（外部目录授权）
   * @param answers - AskUserQuestion 专用：用户作答映射
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
