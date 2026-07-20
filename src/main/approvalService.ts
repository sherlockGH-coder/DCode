import { BrowserWindow, ipcMain } from 'electron';
import { logChatEvent } from './logger';
import { addAllowedDirToSession } from './pathAllowList';
import type { PendingApprovalRequest } from '../shared/types';

export type ApprovalRequest = PendingApprovalRequest;

/**
 * 用户决策。新增的 scope 字段用于「本会话允许」时告诉主进程要把
 * 什么加入会话级 allow list。
 */
export interface ApprovalDecision {
  allowed: boolean;
  reason?: string;
  /** 用户勾选「本会话允许」时为 true（项目外路径场景） */
  rememberForSession?: boolean;
  /** 「本会话允许」的语义对象：当前仅支持 outOfScopeDir */
  scope?: { kind: 'outOfScopeDir'; dir: string };
  /** AskUserQuestion 专用：用户作答映射（question → answer） */
  answers?: Record<string, string>;
}

type Pending = {
  resolve: (decision: ApprovalDecision) => void;
  req: ApprovalRequest;
};

class ApprovalService {
  private pending = new Map<string, Pending>();

  /** 工具调用 — 等待用户决策，返回是否放行 */
  request(req: ApprovalRequest): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve) => {
      this.pending.set(req.toolCallId, { resolve, req });

      const target = req.targetWebContentsId;
      if (target !== undefined) {
        const win = BrowserWindow.getAllWindows().find((candidate) => {
          return candidate.webContents.id === target;
        });
        if (win && !win.webContents.isDestroyed()) {
          win.webContents.send('tool:approval-request', req);
          return;
        }
      }

      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.webContents.isDestroyed()) {
          win.webContents.send('tool:approval-request', req);
        }
      }
    });
  }

  /** 用户决策回调（IPC 入口） */
  resolve(toolCallId: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(toolCallId);
    if (!entry) return false;
    this.pending.delete(toolCallId);

    if (
      decision.allowed &&
      decision.rememberForSession &&
      decision.scope?.kind === 'outOfScopeDir'
    ) {
      addAllowedDirToSession(entry.req.conversationId, decision.scope.dir);
    }

    logChatEvent('approval', {
      traceId: entry.req.traceId ?? 'unknown',
      conversationId: entry.req.conversationId ?? null,
      toolCallId,
      kind: entry.req.kind,
      allowed: decision.allowed,
      reason: decision.reason,
      rememberForSession: decision.rememberForSession,
      outOfScope: !!entry.req.outOfScope,
    });

    entry.resolve(decision);
    return true;
  }

  /** 渲染进程热加载 / 重挂载后，用于恢复仍在等待的审批 UI。 */
  listPending(conversationId?: string | null): ApprovalRequest[] {
    return [...this.pending.values()]
      .map((entry) => entry.req)
      .filter((req) => {
        if (conversationId === undefined) return true;
        return req.conversationId === conversationId;
      });
  }

  /** 兜底：会话取消时把所有挂起的请求拒掉 */
  rejectAll(reason = 'Cancelled'): void {
    for (const [, entry] of this.pending) {
      entry.resolve({ allowed: false, reason });
    }
    this.pending.clear();
  }

  /** 会话取消时只拒掉该会话挂起的审批，避免影响其他窗口正在运行的任务。 */
  rejectForConversation(conversationId: string, reason = 'Cancelled'): void {
    for (const [toolCallId, entry] of this.pending) {
      if (entry.req.conversationId !== conversationId) continue;
      entry.resolve({ allowed: false, reason });
      this.pending.delete(toolCallId);
    }
  }
}

export const approvalService = new ApprovalService();

export function registerApprovalIpc(): void {
  ipcMain.handle('approval:listPending', (_event, conversationId?: string | null) => {
    return approvalService.listPending(conversationId);
  });

  ipcMain.handle(
    'approval:respond',
    (
      _event,
      toolCallId: string,
      allowed: boolean,
      reason?: string,
      rememberForSession?: boolean,
      scope?: { kind: 'outOfScopeDir'; dir: string },
      answers?: Record<string, string>,
    ) => {
      return approvalService.resolve(toolCallId, {
        allowed,
        reason,
        rememberForSession,
        scope,
        answers,
      });
    },
  );
}
