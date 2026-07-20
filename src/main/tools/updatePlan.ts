import { ToolExecutor, ToolExecuteResult } from './types';

type PlanStepStatus = 'pending' | 'in_progress' | 'completed';

interface UpdatePlanItem {
  step: string;
  status: PlanStepStatus;
}

interface UpdatePlanArgs {
  explanation?: string;
  plan: UpdatePlanItem[];
}

const VALID_STATUSES = new Set<PlanStepStatus>(['pending', 'in_progress', 'completed']);

export const updatePlanTool: ToolExecutor = {
  definition: {
    name: 'update_plan',
    description: [
      'Updates the task plan.',
      'Provide an optional explanation and a list of plan items, each with a step and status.',
      'At most one step can be in_progress at a time.',
    ].join('\n'),
    input_schema: {
      type: 'object',
      properties: {
        explanation: {
          type: 'string',
          description: 'Optional explanation for this plan update.',
        },
        plan: {
          type: 'array',
          description: 'The list of steps',
          items: {
            type: 'object',
            properties: {
              step: {
                type: 'string',
                description: 'Task step text.',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'Step status.',
              },
            },
            required: ['step', 'status'],
          },
        },
      },
      required: ['plan'],
    },
  },

  async execute(args): Promise<ToolExecuteResult> {
    const update = parseUpdatePlanArgs(args);
    return {
      content: 'Plan updated',
      metadata: {
        kind: 'plan_update',
        explanation: update.explanation,
        plan: update.plan,
      },
    };
  },
};

function parseUpdatePlanArgs(args: Record<string, unknown>): UpdatePlanArgs {
  const rawPlan = args.plan;
  if (!Array.isArray(rawPlan)) {
    throw new Error('plan must be an array');
  }

  const plan = rawPlan.map((item, index) => parsePlanItem(item, index));
  const inProgressCount = plan.filter((item) => item.status === 'in_progress').length;
  if (inProgressCount > 1) {
    throw new Error('at most one plan item can be in_progress');
  }

  const rawExplanation = args.explanation;
  const explanation = typeof rawExplanation === 'string' && rawExplanation.trim().length > 0
    ? rawExplanation.trim()
    : undefined;

  return { explanation, plan };
}

function parsePlanItem(item: unknown, index: number): UpdatePlanItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`plan[${index}] must be an object`);
  }

  const candidate = item as Record<string, unknown>;
  const step = candidate.step;
  if (typeof step !== 'string' || step.trim().length === 0) {
    throw new Error(`plan[${index}].step must be a non-empty string`);
  }

  const status = candidate.status;
  if (typeof status !== 'string' || !VALID_STATUSES.has(status as PlanStepStatus)) {
    throw new Error(`plan[${index}].status must be pending, in_progress, or completed`);
  }

  return {
    step: step.trim(),
    status: status as PlanStepStatus,
  };
}
