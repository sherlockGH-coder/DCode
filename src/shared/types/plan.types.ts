export type ConversationMode = 'execute' | 'plan' | 'transitioning_to_execute';

export type ConversationRunPhase =
  | 'idle'
  | 'running'
  | 'awaiting_plan_approval'
  | 'replanning';

export type PlanArtifactStatus = 'pending_approval' | 'approved' | 'rejected' | 'superseded';
export type PlanExecutionStrategy = 'same_context' | 'fresh_context';
export type PlanInvalidationReason =
  | 'user_feedback'
  | 'new_plan'
  | 'manual_exit'
  | 'branch_changed'
  | 'history_truncated';

export interface PlanDocument {
  title: string;
  summary: string;
  implementationSteps: string[];
  testPlan: string[];
  assumptions: string[];
}

export interface PlanArtifact extends PlanDocument {
  id: string;
  conversationId: string;
  version: number;
  sourceTurnId: string;
  sourceAttemptNo: number;
  baseContentRevision: number;
  markdown: string;
  contentHash: string;
  status: PlanArtifactStatus;
  invalidationReason?: PlanInvalidationReason;
  decisionFeedback?: string;
  executionStrategy?: PlanExecutionStrategy;
  executionTurnId?: string;
  createdAt: string;
  presentedAt?: string;
  decidedAt?: string;
}

export interface ConversationModeState {
  conversationId: string;
  mode: ConversationMode;
  phase: ConversationRunPhase;
  modeRevision: number;
  contentRevision: number;
  contextEpoch: number;
  activePlan: PlanArtifact | null;
}

export interface SetConversationModeRequest {
  conversationId: string;
  targetMode: 'execute' | 'plan';
  expectedModeRevision: number;
}

export interface MarkPlanPresentedRequest {
  conversationId: string;
  planId: string;
  version: number;
  contentHash: string;
  modeRevision: number;
}

export interface PlanPresentationToken {
  token: string;
  expiresAt: number;
}

export type PlanDecisionRequest =
  | {
      conversationId: string;
      planId: string;
      version: number;
      contentHash: string;
      presentationToken: string;
      decision: 'approve';
      strategy: PlanExecutionStrategy;
    }
  | {
      conversationId: string;
      planId: string;
      version: number;
      contentHash: string;
      presentationToken: string;
      decision: 'reject';
      feedback?: string;
    };

export interface ApprovedPlanExecution {
  plan: PlanArtifact;
  strategy: PlanExecutionStrategy;
  executionTurnId: string;
}

export interface PlanDecisionResult {
  state: ConversationModeState;
  execution?: ApprovedPlanExecution;
  replanFeedback?: string;
}

export interface PlanExecutionRequest {
  planId: string;
  strategy: PlanExecutionStrategy;
  executionTurnId: string;
}
