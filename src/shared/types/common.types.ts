/** 作用域：内置 / 用户全局 / 项目内 */
export type Scope = 'builtin' | 'user' | 'project';

/** 基础作用域：用户全局 / 项目内（不含 builtin） */
export type BasicScope = 'user' | 'project';

/** 基础状态：待处理 / 进行中 / 已完成 */
export type BaseStatus = 'pending' | 'in_progress' | 'completed';

/** API Key 设置状态的通用接口 */
export interface WithApiKey {
  /** 是否已设置 API Key（明文不会传到渲染端） */
  apiKeySet: boolean;
}

/** 通用的错误分类 */
export type ErrorKind = 'rate_limit' | 'network' | 'auth' | 'timeout' | 'unknown';
