import { createHash, randomUUID } from 'node:crypto';
import type {
  ConversationModeState,
  MarkPlanPresentedRequest,
  PlanArtifact,
  PlanDecisionRequest,
  PlanDecisionResult,
  PlanDocument,
  PlanExecutionStrategy,
  PlanExecutionRequest,
  PlanPresentationToken,
  SetConversationModeRequest,
} from '../../shared/types';
import { getRawDatabase } from '../database';

const PRESENTATION_TOKEN_TTL_MS = 10 * 60 * 1000;

interface PresentationGrant {
  token: string;
  webContentsId: number;
  conversationId: string;
  planId: string;
  version: number;
  contentHash: string;
  modeRevision: number;
  expiresAt: number;
}

const presentationGrants = new Map<string, PresentationGrant>();

function jsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mapPlan(row: any): PlanArtifact {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    version: row.version,
    sourceTurnId: row.source_turn_id,
    sourceAttemptNo: row.source_attempt_no,
    baseContentRevision: row.base_content_revision,
    title: row.title,
    summary: row.summary,
    implementationSteps: jsonArray(row.implementation_steps),
    testPlan: jsonArray(row.test_plan),
    assumptions: jsonArray(row.assumptions),
    markdown: row.markdown,
    contentHash: row.content_hash,
    status: row.status,
    invalidationReason: row.invalidation_reason ?? undefined,
    decisionFeedback: row.decision_feedback ?? undefined,
    executionStrategy: row.execution_strategy ?? undefined,
    executionTurnId: row.execution_turn_id ?? undefined,
    createdAt: row.created_at,
    presentedAt: row.presented_at ?? undefined,
    decidedAt: row.decided_at ?? undefined,
  };
}

function requireConversation(conversationId: string): any {
  const row = getRawDatabase().prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!row) throw new Error('Conversation not found');
  return row;
}

function getActivePlan(conversationId: string, id?: string | null): PlanArtifact | null {
  if (!id) return null;
  const row = getRawDatabase().prepare(
    'SELECT * FROM plan_artifacts WHERE id = ? AND conversation_id = ?',
  ).get(id, conversationId);
  return row ? mapPlan(row) : null;
}

export function getConversationModeState(conversationId: string): ConversationModeState {
  const row = requireConversation(conversationId);
  const activePlan = getActivePlan(conversationId, row.active_plan_artifact_id);
  const mode = row.collaboration_mode ?? 'execute';
  return {
    conversationId,
    mode,
    phase: activePlan?.status === 'pending_approval'
      ? 'awaiting_plan_approval'
      : 'idle',
    modeRevision: row.mode_revision ?? 0,
    contentRevision: row.content_revision ?? 0,
    contextEpoch: row.current_context_epoch ?? 0,
    activePlan: activePlan?.status === 'pending_approval' ? activePlan : null,
  };
}

export function setConversationMode(request: SetConversationModeRequest): ConversationModeState {
  const database = getRawDatabase();
  database.transaction(() => {
    const row = requireConversation(request.conversationId);
    if ((row.mode_revision ?? 0) !== request.expectedModeRevision) {
      throw new Error('Mode changed; refresh and try again');
    }
    if (request.targetMode === 'execute' && row.active_plan_artifact_id) {
      database.prepare(`
        UPDATE plan_artifacts
        SET status = 'superseded', invalidation_reason = 'manual_exit', decided_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending_approval'
      `).run(row.active_plan_artifact_id);
    }
    database.prepare(`
      UPDATE conversations
      SET collaboration_mode = ?, mode_revision = COALESCE(mode_revision, 0) + 1,
          active_plan_artifact_id = CASE WHEN ? = 'execute' THEN NULL ELSE active_plan_artifact_id END
      WHERE id = ?
    `).run(request.targetMode, request.targetMode, request.conversationId);
  })();
  revokeConversationGrants(request.conversationId);
  return getConversationModeState(request.conversationId);
}

function normalizeList(value: unknown, field: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const items = value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean);
  if (!allowEmpty && items.length === 0) throw new Error(`${field} must not be empty`);
  return items;
}

function normalizeDocument(input: PlanDocument): PlanDocument {
  const title = input.title?.trim();
  const summary = input.summary?.trim();
  if (!title || !summary) throw new Error('title and summary are required');
  return {
    title,
    summary,
    implementationSteps: normalizeList(input.implementationSteps, 'implementationSteps'),
    testPlan: normalizeList(input.testPlan, 'testPlan'),
    assumptions: normalizeList(input.assumptions ?? [], 'assumptions', true),
  };
}

function renderPlan(document: PlanDocument): string {
  const steps = document.implementationSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const tests = document.testPlan.map((test) => `- ${test}`).join('\n');
  const assumptions = document.assumptions.length
    ? document.assumptions.map((assumption) => `- ${assumption}`).join('\n')
    : '- 无';
  return `# ${document.title}\n\n${document.summary}\n\n## 实施步骤\n\n${steps}\n\n## 测试与验收\n\n${tests}\n\n## 假设\n\n${assumptions}`;
}

export function submitPlanArtifact(input: {
  conversationId: string;
  sourceTurnId: string;
  sourceAttemptNo: number;
  modeRevision: number;
  document: PlanDocument;
}): PlanArtifact {
  const document = normalizeDocument(input.document);
  const markdown = renderPlan(document);
  if (markdown.length > 100_000) throw new Error('Plan is too large');
  const contentHash = createHash('sha256').update(markdown).digest('hex');
  const database = getRawDatabase();
  let id = '';
  database.transaction(() => {
    const conversation = requireConversation(input.conversationId);
    if (conversation.collaboration_mode !== 'plan') throw new Error('submit_plan is only allowed in Plan mode');
    if ((conversation.mode_revision ?? 0) !== input.modeRevision) throw new Error('Plan mode revision is stale');
    database.prepare(`
      UPDATE plan_artifacts
      SET status = 'superseded', invalidation_reason = 'new_plan', decided_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND status = 'pending_approval'
    `).run(input.conversationId);
    const versionRow = database.prepare(
      'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM plan_artifacts WHERE conversation_id = ?',
    ).get(input.conversationId) as { version: number };
    id = randomUUID();
    database.prepare(`
      INSERT INTO plan_artifacts (
        id, conversation_id, version, source_turn_id, source_attempt_no,
        base_content_revision, title, summary, implementation_steps, test_plan,
        assumptions, markdown, content_hash, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval')
    `).run(
      id, input.conversationId, versionRow.version, input.sourceTurnId, input.sourceAttemptNo,
      conversation.content_revision ?? 0, document.title, document.summary,
      JSON.stringify(document.implementationSteps), JSON.stringify(document.testPlan),
      JSON.stringify(document.assumptions), markdown, contentHash,
    );
    database.prepare(
      'UPDATE conversations SET active_plan_artifact_id = ? WHERE id = ?',
    ).run(id, input.conversationId);
  })();
  revokeConversationGrants(input.conversationId);
  return getActivePlan(input.conversationId, id)!;
}

export function markPlanPresented(
  request: MarkPlanPresentedRequest,
  webContentsId: number,
): PlanPresentationToken {
  const state = getConversationModeState(request.conversationId);
  const plan = state.activePlan;
  if (
    state.mode !== 'plan'
    || !plan
    || plan.id !== request.planId
    || plan.version !== request.version
    || plan.contentHash !== request.contentHash
    || state.modeRevision !== request.modeRevision
  ) throw new Error('Plan is no longer eligible for approval');
  const token = randomUUID();
  const expiresAt = Date.now() + PRESENTATION_TOKEN_TTL_MS;
  presentationGrants.set(token, {
    token, expiresAt, webContentsId,
    conversationId: request.conversationId,
    planId: request.planId,
    version: request.version,
    contentHash: request.contentHash,
    modeRevision: request.modeRevision,
  });
  getRawDatabase().prepare(
    'UPDATE plan_artifacts SET presented_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(plan.id);
  return { token, expiresAt };
}

function consumeGrant(request: PlanDecisionRequest, webContentsId: number): void {
  const grant = presentationGrants.get(request.presentationToken);
  presentationGrants.delete(request.presentationToken);
  if (!grant || grant.expiresAt < Date.now()) throw new Error('Plan presentation expired');
  if (
    grant.webContentsId !== webContentsId
    || grant.conversationId !== request.conversationId
    || grant.planId !== request.planId
    || grant.version !== request.version
    || grant.contentHash !== request.contentHash
  ) throw new Error('Plan presentation does not match this decision');
}

export function decidePlan(request: PlanDecisionRequest, webContentsId: number): PlanDecisionResult {
  consumeGrant(request, webContentsId);
  const database = getRawDatabase();
  let executionTurnId: string | undefined;
  database.transaction(() => {
    const conversation = requireConversation(request.conversationId);
    const planRow = database.prepare('SELECT * FROM plan_artifacts WHERE id = ?').get(request.planId) as any;
    if (!planRow || planRow.status !== 'pending_approval') throw new Error('Plan is no longer pending approval');
    if (conversation.collaboration_mode !== 'plan' || conversation.active_plan_artifact_id !== request.planId) {
      throw new Error('Plan is no longer active');
    }
    if ((conversation.content_revision ?? 0) !== planRow.base_content_revision) {
      throw new Error('Plan was invalidated by newer user input');
    }
    if (request.decision === 'reject') {
      const feedback = request.feedback?.trim() || '请根据我的反馈重新规划。';
      database.prepare(`
        UPDATE plan_artifacts SET status = 'rejected', decision_feedback = ?, decided_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(feedback, request.planId);
      database.prepare(
        'UPDATE conversations SET active_plan_artifact_id = NULL WHERE id = ?',
      ).run(request.conversationId);
      return;
    }
    executionTurnId = randomUUID();
    const strategy: PlanExecutionStrategy = request.strategy;
    const nextEpoch = strategy === 'fresh_context'
      ? (conversation.current_context_epoch ?? 0) + 1
      : conversation.current_context_epoch ?? 0;
    database.prepare(`
      UPDATE plan_artifacts
      SET status = 'approved', execution_strategy = ?, execution_turn_id = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(strategy, executionTurnId, request.planId);
    database.prepare(`
      UPDATE conversations
      SET collaboration_mode = 'execute', mode_revision = COALESCE(mode_revision, 0) + 1,
          current_context_epoch = ?, active_plan_artifact_id = NULL
      WHERE id = ?
    `).run(nextEpoch, request.conversationId);
    database.prepare(`
      INSERT INTO plan_execution_runs (
        id, conversation_id, plan_artifact_id, execution_turn_id, strategy, status, context_epoch
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(randomUUID(), request.conversationId, request.planId, executionTurnId, strategy, nextEpoch);
  })();
  revokeConversationGrants(request.conversationId);
  const state = getConversationModeState(request.conversationId);
  if (request.decision === 'reject') {
    return { state, replanFeedback: request.feedback?.trim() || '请根据我的反馈重新规划。' };
  }
  const planRow = getRawDatabase().prepare('SELECT * FROM plan_artifacts WHERE id = ?').get(request.planId);
  const plan = mapPlan(planRow);
  return {
    state,
    execution: { plan, strategy: request.strategy, executionTurnId: executionTurnId! },
  };
}

export function getPlanArtifact(planId: string): PlanArtifact | null {
  const row = getRawDatabase().prepare('SELECT * FROM plan_artifacts WHERE id = ?').get(planId);
  return row ? mapPlan(row) : null;
}

export function beginPlanExecution(
  conversationId: string,
  request: PlanExecutionRequest,
  turnId?: string,
): PlanArtifact {
  const database = getRawDatabase();
  let plan: PlanArtifact | null = null;
  database.transaction(() => {
    const conversation = requireConversation(conversationId);
    if (conversation.collaboration_mode !== 'execute') {
      throw new Error('Approved plan execution requires Execute mode');
    }
    if (turnId !== request.executionTurnId) {
      throw new Error('Plan execution turn does not match the approved transition');
    }
    const planRow = database.prepare('SELECT * FROM plan_artifacts WHERE id = ? AND conversation_id = ?')
      .get(request.planId, conversationId) as any;
    if (
      !planRow
      || planRow.status !== 'approved'
      || planRow.execution_strategy !== request.strategy
      || planRow.execution_turn_id !== request.executionTurnId
    ) {
      throw new Error('Approved plan execution request is stale or does not match the approval');
    }
    const result = database.prepare(`
      UPDATE plan_execution_runs
      SET status = 'running', started_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND plan_artifact_id = ? AND execution_turn_id = ?
        AND strategy = ? AND status = 'pending'
    `).run(conversationId, request.planId, request.executionTurnId, request.strategy);
    if (result.changes !== 1) throw new Error('Approved plan execution was already started or is unavailable');
    plan = mapPlan(planRow);
  })();
  return plan!;
}

export function finishPlanExecution(
  conversationId: string,
  executionTurnId: string,
  error?: string,
): void {
  const database = getRawDatabase();
  database.prepare(`
    UPDATE plan_execution_runs
    SET status = ?, error = ?, completed_at = CURRENT_TIMESTAMP
    WHERE conversation_id = ? AND execution_turn_id = ? AND status = 'running'
  `).run(error ? 'failed' : 'completed', error ?? null, conversationId, executionTurnId);
}

export function revokeConversationGrants(conversationId: string): void {
  for (const [token, grant] of presentationGrants) {
    if (grant.conversationId === conversationId) presentationGrants.delete(token);
  }
}
