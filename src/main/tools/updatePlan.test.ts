import { describe, expect, it } from 'vitest';
import { updatePlanTool } from './updatePlan';

describe('updatePlanTool', () => {
  it('returns plan metadata for valid checklist updates', async () => {
    const result = await updatePlanTool.execute(
      {
        explanation: 'Inspect and implement',
        plan: [
          { step: 'Inspect code', status: 'completed' },
          { step: 'Implement tool', status: 'in_progress' },
          { step: 'Run validation', status: 'pending' },
        ],
      },
      {
        projectPath: null,
        toolCallId: 'call-1',
      },
    );

    expect(result).toEqual({
      content: 'Plan updated',
      metadata: {
        kind: 'plan_update',
        explanation: 'Inspect and implement',
        plan: [
          { step: 'Inspect code', status: 'completed' },
          { step: 'Implement tool', status: 'in_progress' },
          { step: 'Run validation', status: 'pending' },
        ],
      },
    });
  });

  it('rejects multiple in-progress steps', async () => {
    await expect(
      updatePlanTool.execute(
        {
          plan: [
            { step: 'First', status: 'in_progress' },
            { step: 'Second', status: 'in_progress' },
          ],
        },
        {
          projectPath: null,
          toolCallId: 'call-1',
        },
      ),
    ).rejects.toThrow('at most one plan item can be in_progress');
  });
});
