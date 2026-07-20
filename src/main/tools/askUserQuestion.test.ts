import { describe, expect, it, vi, beforeEach } from 'vitest';
import { approvalService } from '../approvalService';
import { askUserQuestionTool } from './askUserQuestion';
import type { ToolExecutionContext } from './types';

vi.mock('../approvalService', () => ({
  approvalService: {
    request: vi.fn(),
  },
}));

function context(): ToolExecutionContext {
  return {
    projectPath: '/tmp/project',
    toolCallId: 'call_question',
    conversationId: 'conv_1',
    turnId: 'turn_1',
    attemptNo: 1,
  };
}

describe('ask_user_question tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses concise Claude-style guidance and defaults multiSelect in the schema', () => {
    expect(askUserQuestionTool.definition.description).toContain('Ask the user multiple-choice questions');
    expect(askUserQuestionTool.definition.description).toContain('Do not add an "Other" option');

    const schema = askUserQuestionTool.definition.input_schema as {
      properties: {
        questions: {
          items: {
            properties: Record<string, Record<string, unknown>>;
            required: string[];
            additionalProperties?: boolean;
          };
        };
      };
      additionalProperties?: boolean;
    };
    expect(schema.properties.questions.items.properties.multiSelect.default).toBe(false);
    expect(schema.properties.questions.items.required).not.toContain('multiSelect');
    expect(schema.properties.questions.items.additionalProperties).toBe(false);
    expect(schema.additionalProperties).toBe(false);
  });

  it('normalizes omitted multiSelect to false before requesting an answer', async () => {
    vi.mocked(approvalService.request).mockResolvedValue({
      allowed: true,
      answers: { 'Which path?': 'Fast path' },
    });

    const result = await askUserQuestionTool.execute({
      questions: [{
        question: 'Which path?',
        header: 'Path',
        options: [
          { label: 'Fast path', description: 'Ship the smaller fix.' },
          { label: 'Full path', description: 'Handle the broader refactor.' },
        ],
      }],
    }, context());

    expect(result.content).toContain('"Which path?"="Fast path"');
    expect(result.metadata).toEqual({
      kind: 'ask_user_question',
      questions: [expect.objectContaining({ multiSelect: false })],
      answers: { 'Which path?': 'Fast path' },
    });
    expect(approvalService.request).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'ask_user_question',
      questions: [expect.objectContaining({ multiSelect: false })],
    }));
  });

  it('rejects duplicate question text and duplicate option labels', async () => {
    const duplicateQuestions = await askUserQuestionTool.execute({
      questions: [
        {
          question: 'Pick one?',
          header: 'One',
          options: [
            { label: 'A', description: 'A' },
            { label: 'B', description: 'B' },
          ],
        },
        {
          question: 'Pick one?',
          header: 'Two',
          options: [
            { label: 'C', description: 'C' },
            { label: 'D', description: 'D' },
          ],
        },
      ],
    }, context());

    const duplicateOptions = await askUserQuestionTool.execute({
      questions: [{
        question: 'Pick one?',
        header: 'One',
        options: [
          { label: 'A', description: 'First A' },
          { label: 'A', description: 'Second A' },
        ],
      }],
    }, context());

    expect(duplicateQuestions.error).toBe(true);
    expect(duplicateQuestions.content).toContain('question texts must be unique');
    expect(duplicateOptions.error).toBe(true);
    expect(duplicateOptions.content).toContain('option labels must be unique');
    expect(approvalService.request).not.toHaveBeenCalled();
  });
});
