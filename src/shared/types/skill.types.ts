import type { Scope } from './common.types';

/** Scope: built-in, global user, or project; duplicate names use project > user > built-in priority. */
export type SkillScope = Scope;

/** Skill summary without the body, used by the frontend list and system-prompt injection. */
export interface SkillSummary {
  name: string;
  description: string;
  scope: SkillScope;
  filePath: string;
  /** Optional frontmatter allowed-tools, appended as a note when load_skill returns the skill. */
  allowedTools?: string[];
  /** Derived from settings.permissions.skills.disabled. */
  enabled: boolean;
}

/** Complete skill data including Markdown body, read by load_skill or the editor. */
export interface Skill extends SkillSummary {
  body: string;
}
