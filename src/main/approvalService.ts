import { BrowserWindow, ipcMain } from 'electron';
import { addAllowedDirToSession } from './pathAllowList';
import type { PendingApprovalRequest } from '../shared/types';

export type ApprovalRequest = PendingApprovalRequest;

/**
 * User decisions. The scope field tells the main process what to add to the session allowlist when the user chooses "Allow for this session".
 */
interface ApprovalDecision {
  allowed: boolean;
  reason?: string;
  /** True when the user selects "Allow for this session", used for paths outside the project. */
  rememberForSession?: boolean;
  /** Semantic object for "Allow for this session"; currently only outOfScopeDir is supported. */
  scope?: { kind: 'outOfScopeDir'; dir: string };
  /** Answer mapping for AskUserQuestion, from question to answer. */
  answers?: Record<string, string>;
}

type Pending = {
  resolve: (decision: ApprovalDecision) => void;
  req: ApprovalRequest;
};

class ApprovalService {
  private pending = new Map<string, Pending>();

  /** Tool call waiting for the user's decision; returns whether it is allowed. */
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

  /** User decision callback, exposed through IPC. */
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

    entry.resolve(decision);
    return true;
  }

  /** Restore approval UI that is still waiting after renderer hot reload or remount. */
  listPending(conversationId?: string | null): ApprovalRequest[] {
    return [...this.pending.values()]
      .map((entry) => entry.req)
      .filter((req) => {
        if (conversationId === undefined) return true;
        return req.conversationId === conversationId;
      });
  }

  /** Fallback: reject all pending requests when the session is cancelled. */
  rejectAll(reason = 'Cancelled'): void {
    for (const [, entry] of this.pending) {
      entry.resolve({ allowed: false, reason });
    }
    this.pending.clear();
  }

  /** When a session is cancelled, reject only its pending approvals so tasks in other windows are not affected. */
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
