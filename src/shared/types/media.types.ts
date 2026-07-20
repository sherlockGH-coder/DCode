import type { WithApiKey } from './common.types';

export type VisionProvider = 'anthropic' | 'openai' | 'custom' | 'none';

export interface VisionSettings extends WithApiKey {
  /** 旧版开关字段；保留用于兼容已有设置。 */
  enabled: boolean;
  /** 视觉识别 API 协议 */
  provider: VisionProvider;
  /** API Base URL */
  baseUrl: string;
  /** 视觉模型名 */
  model: string;
}

export interface SpeechTranscriptionResult {
  text: string;
  durationMs: number;
}

export type SpeechProvider = 'openai-compatible';

export interface SpeechSettings extends WithApiKey {
  provider: SpeechProvider;
  baseUrl: string;
  model: string;
  language: string;
  maxDurationSeconds: number;
}
