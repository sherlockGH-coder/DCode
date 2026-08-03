import type { ToolExecutor, ToolExecuteResult } from '../tools/types';
import { skillsManager } from './manager';

export const loadSkillTool: ToolExecutor = {
  isReadonly: true,
  definition: {
    name: 'load_skill',
    description:
      'Load the full instructions for a skill. Call this when a skill listed under "Available Skills" in the system prompt matches the current user request.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Skill name; it must match a name listed in the system prompt.',
        },
      },
      required: ['name'],
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const name = String(args.name ?? '').trim();
    if (!name) {
      return { content: 'load_skill requires a name parameter', error: true };
    }

    const skill = skillsManager.read(name, ctx.projectPath);
    if (!skill) {
      return { content: `Skill "${name}" does not exist or is disabled`, error: true };
    }
    if (!skill.enabled) {
      return { content: `Skill "${name}" is disabled`, error: true };
    }

    const toolsHint = skill.allowedTools && skill.allowedTools.length > 0
      ? `\n\n[Execution constraint] When using this skill, only these tools may be used: ${skill.allowedTools.join(', ')}`
      : '';

    return {
      content: `# Skill: ${skill.name}\n${skill.description}\n\n${skill.body.trim()}${toolsHint}`,
    };
  },
};
