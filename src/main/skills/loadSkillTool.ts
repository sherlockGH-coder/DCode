import type { ToolExecutor, ToolExecuteResult } from '../tools/types';
import { skillsManager } from './manager';

export const loadSkillTool: ToolExecutor = {
  isReadonly: true,
  definition: {
    name: 'load_skill',
    description:
      '加载指定 skill 的完整指令正文。当 system prompt 中「Available Skills」列出的 skill 与当前用户请求匹配时调用。',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Skill 名称，必须与 system prompt 中列出的一致',
        },
      },
      required: ['name'],
    },
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    const name = String(args.name ?? '').trim();
    if (!name) {
      return { content: 'load_skill 需要 name 参数', error: true };
    }

    const skill = skillsManager.read(name, ctx.projectPath);
    if (!skill) {
      return { content: `Skill "${name}" 不存在或已禁用`, error: true };
    }
    if (!skill.enabled) {
      return { content: `Skill "${name}" 已被禁用`, error: true };
    }

    const toolsHint = skill.allowedTools && skill.allowedTools.length > 0
      ? `\n\n[执行约束] 调用本 skill 时只能使用以下工具：${skill.allowedTools.join(', ')}`
      : '';

    return {
      content: `# Skill: ${skill.name}\n${skill.description}\n\n${skill.body.trim()}${toolsHint}`,
    };
  },
};
