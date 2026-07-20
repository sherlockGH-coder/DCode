import type { Scope } from './common.types';

/** 作用域：内置 / 用户全局 / 项目内（同名优先级 project > user > builtin） */
export type SkillScope = Scope;

/** Skill 摘要（不含正文，前端列表 / system prompt 注入用） */
export interface SkillSummary {
  name: string;
  description: string;
  scope: SkillScope;
  filePath: string;
  /** frontmatter 的 allowed-tools（可选）— load_skill 返回时附加文字提示 */
  allowedTools?: string[];
  /** 由 settings.permissions.skills.disabled 反推 */
  enabled: boolean;
}

/** Skill 完整数据（含 markdown 正文，load_skill 工具或编辑器读取） */
export interface Skill extends SkillSummary {
  body: string;
}
