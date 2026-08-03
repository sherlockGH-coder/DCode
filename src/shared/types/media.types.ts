import type { WithApiKey } from './common.types';

export type VisionProvider = 'anthropic' | 'openai' | 'custom' | 'none';

export interface VisionSettings extends WithApiKey {
  /** Legacy toggle field retained for compatibility with existing settings. */
  enabled: boolean;
  /** Vision API protocol. */
  provider: VisionProvider;
  /** API Base URL */
  baseUrl: string;
  /** Vision model name. */
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
