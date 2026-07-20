import { ToolExecutor, ToolExecuteResult } from './types';
import { approvalService } from '../approvalService';

interface QuestionOption {
  label: string;
  description: string;
}

interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

interface AskUserQuestionArgs {
  questions: Question[];
}

export const askUserQuestionTool: ToolExecutor = {
  isReadonly: true,
  definition: {
    name: 'ask_user_question',
    description:
      'Ask the user multiple-choice questions to clarify requirements, preferences, or implementation choices during execution. Ask 1-4 focused questions, each with 2-4 distinct options. Do not add an "Other" option; the UI provides it. Put the recommended option first and suffix its label with "(Recommended)" when applicable.',
    input_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: '要问用户的问题列表（1-4 个）',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Clear, specific question text. It should be unique and end with a question mark.',
              },
              header: {
                type: 'string',
                description: 'Very short chip label, max 12 characters.',
                maxLength: 12,
              },
              options: {
                type: 'array',
                description: '2-4 distinct choices. Use mutually exclusive choices unless multiSelect is true.',
                minItems: 2,
                maxItems: 4,
                items: {
                  type: 'object',
                  properties: {
                    label: {
                      type: 'string',
                      description: 'Concise option label, ideally 1-5 words.',
                    },
                    description: {
                      type: 'string',
                      description: 'What this option means or what will happen if chosen.',
                    },
                  },
                  required: ['label', 'description'],
                  additionalProperties: false,
                },
              },
              multiSelect: {
                type: 'boolean',
                description: 'Allow selecting multiple options. Defaults to false.',
                default: false,
              },
            },
            required: ['question', 'header', 'options'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const { questions: rawQuestions } = args as unknown as AskUserQuestionArgs;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return {
        content: 'Error: questions array must not be empty',
        error: true,
      };
    }
    if (rawQuestions.length > 4) {
      return {
        content: 'Error: ask_user_question supports at most 4 questions',
        error: true,
      };
    }

    const questionTexts = rawQuestions.map((q) => q.question);
    if (questionTexts.length !== new Set(questionTexts).size) {
      return {
        content: 'Error: question texts must be unique',
        error: true,
      };
    }

    const questions: Array<Question & { multiSelect: boolean }> = [];
    for (const question of rawQuestions) {
      if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
        return {
          content: 'Error: each question must provide 2-4 options',
          error: true,
        };
      }
      const labels = question.options.map((option) => option.label);
      if (labels.length !== new Set(labels).size) {
        return {
          content: `Error: option labels must be unique for question: ${question.question}`,
          error: true,
        };
      }
      questions.push({
        ...question,
        multiSelect: question.multiSelect ?? false,
      });
    }

    const decision = await approvalService.request({
      toolCallId: ctx.toolCallId,
      kind: 'ask_user_question',
      command: questions.map((q) => q.question).join('；'),
      cwd: ctx.projectPath,
      questions,
      traceId: ctx.traceId,
      conversationId: ctx.conversationId,
      turnId: ctx.turnId,
      attemptNo: ctx.attemptNo,
      targetWebContentsId: ctx.approvalWebContentsId,
    });

    if (!decision.allowed || !decision.answers) {
      return {
        content: '[User declined to answer] 用户未作答。请基于已有信息继续，或换一种方式询问。',
        error: true,
        metadata: {
          kind: 'ask_user_question',
          questions,
        },
      };
    }

    const answerLines = Object.entries(decision.answers).map(([q, a]) => `"${q}"="${a}"`);
    return {
      content: `用户已作答：${answerLines.join(', ')}。请根据这些选择继续执行。`,
      metadata: {
        kind: 'ask_user_question',
        questions,
        answers: decision.answers,
      },
    };
  },
};
