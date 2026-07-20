import type { PlanDocument } from '../../shared/types';
import { submitPlanArtifact } from '../plan/planService';
import type { ToolExecutor } from './types';

export const submitPlanTool: ToolExecutor = {
  definition: {
    name: 'submit_plan',
    description: [
      'Submit the complete implementation plan for user review.',
      'This ends the current Plan-mode run. Do not call it until the plan is decision-complete.',
      'It does not approve or execute the plan.',
    ].join('\n'),
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        implementationSteps: { type: 'array', items: { type: 'string' } },
        testPlan: { type: 'array', items: { type: 'string' } },
        assumptions: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'summary', 'implementationSteps', 'testPlan', 'assumptions'],
    },
  },
  isReadonly: true,
  async execute(args, ctx) {
    if (!ctx.conversationId || !ctx.turnId || ctx.attemptNo === undefined) {
      throw new Error('submit_plan requires a persisted conversation turn');
    }
    const plan = submitPlanArtifact({
      conversationId: ctx.conversationId,
      sourceTurnId: ctx.turnId,
      sourceAttemptNo: ctx.attemptNo,
      modeRevision: ctx.modeRevision ?? -1,
      document: args as unknown as PlanDocument,
    });
    return {
      content: 'Plan submitted for user approval. End this turn and wait for the user decision.',
      terminal: true,
      metadata: { kind: 'plan_artifact', plan },
    };
  },
};
