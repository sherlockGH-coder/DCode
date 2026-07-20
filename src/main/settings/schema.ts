import { randomUUID } from 'node:crypto';
import type { ApiProfile, ApiProtocol, AppSettings, BashExecPolicy, SpeechProvider, VisionProvider } from '../../shared/types';
import { env } from '../env';

export const STATE_FILE = 'settings.json';
export const USER_SETTINGS_DIR = '.dcode';
export const SPEECH_MIN_DURATION_SECONDS = 5;
export const SPEECH_MAX_DURATION_SECONDS = 180;
export const SPEECH_DEFAULT_DURATION_SECONDS = 60;
export const SPEECH_DEFAULT_MODEL = 'whisper-1';
export const DEFAULT_PROFILE_ID = 'default';

const UNTITLED_PROFILE_NAME = '未命名配置';

export interface PersistedApiProfile {
  id: string;
  name: string;
  protocol: ApiProtocol;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  /** safeStorage 加密后的 base64；缺失/空 = 未设置 */
  apiKeyEncrypted?: string;
  /** 加密不可用时的明文兜底 */
  apiKeyPlain?: string;
}

export interface PersistedShape {
  schemaVersion: 1;
  api: {
    protocol: ApiProtocol;
    baseUrl: string;
    models: string[];
    defaultModel: string;
    /** safeStorage 加密后的 base64；缺失/空 = 未设置 */
    apiKeyEncrypted?: string;
    /** 加密不可用时的明文兜底 */
    apiKeyPlain?: string;
  };
  apiProfiles: PersistedApiProfile[];
  activeApiProfileId: string;
  prompt: {
    systemPromptOverride: string;
  };
  permissions: {
    bashExec: BashExecPolicy;
    bashWhitelist: string[];
    skills: { disabled: string[] };
  };
  search: {
    tavilyApiKeyEncrypted?: string;
    tavilyApiKeyPlain?: string;
  };
  compact: {
    model: string;
    autoThreshold: number;
    keepRecentTurns: number;
    contextLimit: number;
  };
  speech: {
    provider: SpeechProvider;
    baseUrl: string;
    model: string;
    language: string;
    maxDurationSeconds: number;
    apiKeyEncrypted?: string;
    apiKeyPlain?: string;
  };
  vision: {
    enabled: boolean;
    provider: VisionProvider;
    baseUrl: string;
    model: string;
    apiKeyEncrypted?: string;
    apiKeyPlain?: string;
  };
}

export function defaultApiProfile(): PersistedApiProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: '默认配置',
    protocol: 'anthropic',
    baseUrl: env.ANTHROPIC_BASE_URL,
    models: [],
    defaultModel: 'claude-sonnet-4-6',
  };
}

export function defaultBaseUrl(): string {
  return env.ANTHROPIC_BASE_URL;
}

export function defaultModel(): string {
  return 'claude-sonnet-4-6';
}

export function normalizeSpeechProvider(_value: unknown): SpeechProvider {
  return 'openai-compatible';
}

export function normalizeVisionProvider(value: unknown): VisionProvider {
  if (value === 'openai') return 'openai';
  if (value === 'custom') return 'custom';
  if (value === 'none') return 'none';
  return 'anthropic';
}

export function visionDefaultBaseUrl(provider: VisionProvider): string {
  if (provider === 'none') return '';
  if (provider === 'custom') return env.VISION_CUSTOM_BASE_URL;
  if (provider === 'openai') return env.OPENAI_BASE_URL;
  return env.ANTHROPIC_BASE_URL;
}

export function visionDefaultModel(provider: VisionProvider): string {
  if (provider === 'none') return '';
  if (provider === 'custom') return env.VISION_CUSTOM_MODEL || '';
  if (provider === 'openai') return 'gpt-4o';
  return 'claude-sonnet-4-6';
}

export function normalizeModels(models: unknown): string[] {
  if (!Array.isArray(models)) return [];
  const cleaned = models
    .filter((model): model is string => typeof model === 'string')
    .map((model) => model.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

type LegacyProfileInput = Partial<PersistedApiProfile> & { provider?: unknown };

function normalizeApiProtocol(protocol: unknown, legacyProvider?: unknown): ApiProtocol {
  if (protocol === 'anthropic' || protocol === 'legacy-openai') return protocol;
  return legacyProvider === 'openai' ? 'legacy-openai' : 'anthropic';
}

export function normalizeProfile(raw: LegacyProfileInput, fallbackId: string): PersistedApiProfile {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : UNTITLED_PROFILE_NAME;
  const protocol = normalizeApiProtocol(raw.protocol, raw.provider);
  const baseUrl = typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
    ? raw.baseUrl.trim()
    : defaultBaseUrl();
  const profileDefaultModel = typeof raw.defaultModel === 'string' && raw.defaultModel.trim()
    ? raw.defaultModel.trim()
    : defaultModel();

  return {
    id,
    name,
    protocol,
    baseUrl,
    models: normalizeModels(raw.models),
    defaultModel: profileDefaultModel,
    apiKeyEncrypted: typeof raw.apiKeyEncrypted === 'string' ? raw.apiKeyEncrypted : undefined,
    apiKeyPlain: typeof raw.apiKeyPlain === 'string' ? raw.apiKeyPlain : undefined,
  };
}

export function profileToPublic(profile: PersistedApiProfile, apiKeySet: boolean): ApiProfile {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    models: [...profile.models],
    defaultModel: profile.defaultModel,
    apiKeySet,
  };
}

export function buildPublicSettings<TExternal>({
  active,
  externalSettings,
  hasProfileApiKey,
  hasSpeechApiKey,
  hasTavilyApiKey,
  hasVisionApiKey,
  state,
}: {
  active: PersistedApiProfile;
  externalSettings: TExternal;
  hasProfileApiKey: (profile: PersistedApiProfile, externalSettings: TExternal) => boolean;
  hasSpeechApiKey: (externalSettings: TExternal) => boolean;
  hasTavilyApiKey: (externalSettings: TExternal) => boolean;
  hasVisionApiKey: (externalSettings: TExternal) => boolean;
  state: PersistedShape;
}): AppSettings {
  return {
    schemaVersion: 1,
    api: {
      protocol: active.protocol,
      baseUrl: active.baseUrl,
      models: [...active.models],
      defaultModel: active.defaultModel,
      apiKeySet: hasProfileApiKey(active, externalSettings),
    },
    apiProfiles: state.apiProfiles.map((profile) => profileToPublic(
      profile,
      hasProfileApiKey(profile, externalSettings),
    )),
    activeApiProfileId: state.activeApiProfileId,
    prompt: { systemPromptOverride: state.prompt.systemPromptOverride },
    permissions: {
      bashExec: state.permissions.bashExec,
      bashWhitelist: [...state.permissions.bashWhitelist],
      skills: { disabled: [...state.permissions.skills.disabled] },
    },
    search: {
      tavilyApiKeySet: hasTavilyApiKey(externalSettings),
    },
    compact: { ...state.compact },
    speech: {
      provider: state.speech.provider,
      baseUrl: state.speech.baseUrl,
      model: state.speech.model,
      language: state.speech.language,
      maxDurationSeconds: state.speech.maxDurationSeconds,
      apiKeySet: hasSpeechApiKey(externalSettings),
    },
    vision: {
      enabled: state.vision.enabled,
      provider: state.vision.provider,
      baseUrl: state.vision.baseUrl,
      model: state.vision.model,
      apiKeySet: hasVisionApiKey(externalSettings),
    },
  };
}

export function defaults(): PersistedShape {
  const apiProfile = defaultApiProfile();
  return {
    schemaVersion: 1,
    api: {
      protocol: apiProfile.protocol,
      baseUrl: apiProfile.baseUrl,
      models: [...apiProfile.models],
      defaultModel: apiProfile.defaultModel,
    },
    apiProfiles: [apiProfile],
    activeApiProfileId: apiProfile.id,
    prompt: {
      systemPromptOverride: '',
    },
    permissions: {
      bashExec: 'default',
      bashWhitelist: [],
      skills: { disabled: [] },
    },
    search: {},
    compact: {
      model: '',
      autoThreshold: 0.8,
      keepRecentTurns: 3,
      contextLimit: 262144,
    },
    speech: {
      provider: 'openai-compatible',
      baseUrl: env.OPENAI_BASE_URL,
      model: SPEECH_DEFAULT_MODEL,
      language: '',
      maxDurationSeconds: SPEECH_DEFAULT_DURATION_SECONDS,
    },
    vision: {
      enabled: false,
      provider: 'anthropic' as VisionProvider,
      baseUrl: visionDefaultBaseUrl('anthropic'),
      model: visionDefaultModel('anthropic'),
    },
  };
}

export function mergePersistedShape(base: PersistedShape, patch: Partial<PersistedShape>): PersistedShape {
  const rawApi = (patch.api ?? {}) as Partial<PersistedShape['api']> & { provider?: unknown };
  const legacyApi = {
    protocol: normalizeApiProtocol(rawApi.protocol, rawApi.provider),
    baseUrl: typeof rawApi.baseUrl === 'string' && rawApi.baseUrl.trim()
      ? rawApi.baseUrl.trim()
      : base.api.baseUrl,
    models: Array.isArray(rawApi.models) ? normalizeModels(rawApi.models) : base.api.models,
    defaultModel: typeof rawApi.defaultModel === 'string' && rawApi.defaultModel.trim()
      ? rawApi.defaultModel.trim()
      : base.api.defaultModel,
    apiKeyEncrypted: typeof rawApi.apiKeyEncrypted === 'string' ? rawApi.apiKeyEncrypted : base.api.apiKeyEncrypted,
    apiKeyPlain: typeof rawApi.apiKeyPlain === 'string' ? rawApi.apiKeyPlain : base.api.apiKeyPlain,
  };
  const hasProfilePatch = Array.isArray(patch.apiProfiles) && patch.apiProfiles.length > 0;
  const rawProfiles = hasProfilePatch
    ? patch.apiProfiles ?? []
    : [{
      id: DEFAULT_PROFILE_ID,
      name: '默认配置',
      protocol: legacyApi.protocol,
      baseUrl: legacyApi.baseUrl,
      models: legacyApi.models,
      defaultModel: legacyApi.defaultModel,
      apiKeyEncrypted: legacyApi.apiKeyEncrypted,
      apiKeyPlain: legacyApi.apiKeyPlain,
    }];
  const seenIds = new Set<string>();
  const apiProfiles = rawProfiles.map((profile, index) => {
    const normalized = normalizeProfile(profile, index === 0 ? DEFAULT_PROFILE_ID : randomUUID());
    if (seenIds.has(normalized.id)) normalized.id = randomUUID();
    seenIds.add(normalized.id);
    return normalized;
  });
  const activeApiProfileId = typeof patch.activeApiProfileId === 'string'
    && apiProfiles.some((profile) => profile.id === patch.activeApiProfileId)
    ? patch.activeApiProfileId
    : apiProfiles[0].id;
  const activeApiProfile = apiProfiles.find((profile) => profile.id === activeApiProfileId) ?? apiProfiles[0];

  return {
    schemaVersion: 1,
    api: {
      protocol: activeApiProfile.protocol,
      baseUrl: activeApiProfile.baseUrl,
      models: [...activeApiProfile.models],
      defaultModel: activeApiProfile.defaultModel,
      apiKeyEncrypted: activeApiProfile.apiKeyEncrypted,
      apiKeyPlain: activeApiProfile.apiKeyPlain,
    },
    apiProfiles,
    activeApiProfileId,
    prompt: { ...base.prompt, ...(patch.prompt || {}) },
    permissions: {
      ...base.permissions,
      ...(patch.permissions || {}),
      skills: {
        ...base.permissions.skills,
        ...(patch.permissions?.skills || {}),
      },
    },
    search: { ...base.search, ...(patch.search || {}) },
    compact: { ...base.compact, ...(patch.compact || {}) },
    speech: {
      ...base.speech,
      ...(patch.speech || {}),
      provider: normalizeSpeechProvider(patch.speech?.provider ?? base.speech.provider),
      baseUrl: typeof patch.speech?.baseUrl === 'string' && patch.speech.baseUrl.trim()
        ? patch.speech.baseUrl.trim()
        : base.speech.baseUrl,
      model: typeof patch.speech?.model === 'string' && patch.speech.model.trim()
        ? patch.speech.model.trim()
        : base.speech.model,
      language: typeof patch.speech?.language === 'string' ? patch.speech.language.trim() : base.speech.language,
      maxDurationSeconds: typeof patch.speech?.maxDurationSeconds === 'number'
        ? Math.max(SPEECH_MIN_DURATION_SECONDS, Math.min(SPEECH_MAX_DURATION_SECONDS, Math.round(patch.speech.maxDurationSeconds)))
        : base.speech.maxDurationSeconds,
    },
    vision: {
      ...base.vision,
      ...(patch.vision || {}),
      provider: normalizeVisionProvider(patch.vision?.provider ?? base.vision.provider),
      baseUrl: typeof patch.vision?.baseUrl === 'string' && patch.vision.baseUrl.trim()
        ? patch.vision.baseUrl.trim()
        : base.vision.baseUrl,
      model: typeof patch.vision?.model === 'string' && patch.vision.model.trim()
        ? patch.vision.model.trim()
        : base.vision.model,
    },
  };
}
