import type { WithApiKey } from './common.types';
import type { SpeechSettings, VisionSettings } from './media.types';

/** 工具权限模式（历史字段名仍为 bashExec，避免 settings 迁移）
 *  - default:    只读非 bash 工具自动放行；bash / 写入 / 外部状态变更工具需审批
 *  - auto_review:文件读写编辑自动放行；bash / 外部状态变更工具仍需审批
 *  - full_access:完全访问，所有工具权限审批都跳过
 */
export type BashExecPolicy = 'default' | 'auto_review' | 'full_access';
export type ApiProtocol = 'anthropic' | 'legacy-openai';

export interface ApiProfile extends WithApiKey {
  id: string;
  name: string;
  /** 请求协议；legacy-openai 仅用于标记升级前配置，当前运行时不会调用 */
  protocol: ApiProtocol;
  /** API Base URL */
  baseUrl: string;
  /** 用户自定义模型列表；为空时走自动拉取 + .env 兜底 */
  models: string[];
  /** 默认模型 */
  defaultModel: string;
}

export type ApiProfilePatch = Partial<Omit<ApiProfile, 'apiKeySet'>> & { id: string };

/** 全局应用设置（持久化到 <userData>/dcode-app/settings.json） */
export interface AppSettings {
  schemaVersion: 1;
  /** 当前生效配置的兼容视图；运行时请求仍从这里派生 */
  api: {
    /** 当前配置的请求协议兼容状态 */
    protocol: ApiProtocol;
    /** API Base URL */
    baseUrl: string;
    /** 用户自定义模型列表；为空时走自动拉取 + .env 兜底 */
    models: string[];
    /** 默认模型 */
    defaultModel: string;
    /** 是否已设置 API Key（明文不会传到渲染端） */
    apiKeySet: boolean;
  };
  /** 可切换的 API 配置列表 */
  apiProfiles: ApiProfile[];
  /** 当前生效的 API 配置 ID */
  activeApiProfileId: string;
  prompt: {
    /** 覆写默认 system prompt — 空字符串表示走 src/main/prompts/system.md */
    systemPromptOverride: string;
  };
  permissions: {
    bashExec: BashExecPolicy;
    /** @deprecated 旧版 bash 命令前缀白名单；新版权限策略不再使用 */
    bashWhitelist: string[];
    /** 已禁用的 skill 名（空 = 全部启用） */
    skills: { disabled: string[] };
  };
  search: {
    /** Tavily API Key 是否已设置（明文不传到渲染端） */
    tavilyApiKeySet: boolean;
  };
  compact: {
    /** 压缩模型名（使用相同的 baseUrl/apiKey） */
    model: string;
    /** 自动压缩阈值：prompt token 占上下文限制的比例 (0.5-0.95) */
    autoThreshold: number;
    /** 压缩时保留最近几轮用户对话 (1-10) */
    keepRecentTurns: number;
    /** 模型的上下文 token 限制（用于计算自动压缩阈值） */
    contextLimit: number;
  };
  speech: SpeechSettings;
  vision: VisionSettings;
}

/** AppSettings 部分更新（嵌套字段可任意省略） */
export type AppSettingsPatch = {
  api?: Partial<Omit<AppSettings['api'], 'apiKeySet'>>;
  apiProfiles?: ApiProfilePatch[];
  activeApiProfileId?: string;
  prompt?: Partial<AppSettings['prompt']>;
  permissions?: {
    bashExec?: BashExecPolicy;
    bashWhitelist?: string[];
    skills?: { disabled?: string[] };
  };
  search?: { tavilyApiKeySet?: boolean };
  compact?: Partial<AppSettings['compact']>;
  speech?: Partial<Omit<SpeechSettings, 'apiKeySet'>>;
  vision?: Partial<Omit<VisionSettings, 'apiKeySet'>>;
};
