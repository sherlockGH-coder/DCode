import type { WithApiKey } from './common.types';
import type { SpeechSettings, VisionSettings } from './media.types';

/** Tool permission mode; the historical field name remains bashExec to avoid settings migration.
 *  - default: read-only non-bash tools run automatically; bash, writes, and external state changes require approval.
 *  - auto_review: file reads, writes, and edits run automatically; bash and external state changes still require approval.
 *  - full_access: full access; skip all tool permission approvals.
 */
export type BashExecPolicy = 'default' | 'auto_review' | 'full_access';
export type ApiProtocol = 'anthropic' | 'legacy-openai' | 'responses';

export interface ApiProfile extends WithApiKey {
  id: string;
  name: string;
  /** Request protocol; legacy-openai only marks a pre-migration profile and is not called at runtime. */
  protocol: ApiProtocol;
  /** API Base URL */
  baseUrl: string;
  /** User-defined model list; empty means automatic loading with .env fallback. */
  models: string[];
  /** Default model. */
  defaultModel: string;
}

export type ApiProfilePatch = Partial<Omit<ApiProfile, 'apiKeySet'>> & { id: string };

/** Global app settings, persisted to <userData>/deepseek-app/settings.json. */
export interface AppSettings {
  schemaVersion: 1;
  /** Compatibility view of the active profile; runtime requests are still derived from it. */
  api: {
    /** Request-protocol compatibility state for the current profile. */
    protocol: ApiProtocol;
    /** API Base URL */
    baseUrl: string;
    /** User-defined model list; empty means automatic loading with .env fallback. */
    models: string[];
    /** Default model. */
    defaultModel: string;
    /** Whether an API key is configured; plaintext is never sent to the renderer. */
    apiKeySet: boolean;
  };
  /** Switchable API profiles. */
  apiProfiles: ApiProfile[];
  /** ID of the active API profile. */
  activeApiProfileId: string;
  prompt: {
    /** Override the default system prompt; an empty string uses src/main/prompts/system.md. */
    systemPromptOverride: string;
  };
  permissions: {
    bashExec: BashExecPolicy;
    /** @deprecated Legacy bash command-prefix allowlist; unused by the current permission policy. */
    bashWhitelist: string[];
    /** Disabled skill names; empty means all are enabled. */
    skills: { disabled: string[] };
  };
  compact: {
    /** Compaction model name, using the same baseUrl and apiKey. */
    model: string;
    /** Automatic compaction threshold: prompt-token ratio of the context limit (0.5-0.95). */
    autoThreshold: number;
    /** Number of recent user turns to keep during compaction (1-10). */
    keepRecentTurns: number;
    /** Model context-token limit, used to calculate the automatic compaction threshold. */
    contextLimit: number;
  };
  speech: SpeechSettings;
  vision: VisionSettings;
}

/** Partial AppSettings update; nested fields may be omitted independently. */
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
  compact?: Partial<AppSettings['compact']>;
  speech?: Partial<Omit<SpeechSettings, 'apiKeySet'>>;
  vision?: Partial<Omit<VisionSettings, 'apiKeySet'>>;
};
