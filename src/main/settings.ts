import { app } from 'electron';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AppSettings, AppSettingsPatch, BashExecPolicy, SpeechProvider, VisionProvider } from '../shared/types';
import { env } from './env';
import {
  loadExternalSettings,
  resolveExternalApiKey,
  type ExternalSettings,
} from './externalSettings';
import {
  DEFAULT_PROFILE_ID,
  SPEECH_DEFAULT_MODEL,
  SPEECH_MAX_DURATION_SECONDS,
  SPEECH_MIN_DURATION_SECONDS,
  STATE_FILE,
  USER_SETTINGS_DIR,
  buildPublicSettings,
  defaultApiProfile,
  defaultBaseUrl,
  defaultModel,
  defaults,
  mergePersistedShape,
  normalizeModels,
  normalizeProfile,
  normalizeSpeechProvider,
  normalizeVisionProvider,
  visionDefaultBaseUrl,
  visionDefaultModel,
  type PersistedApiProfile,
  type PersistedShape,
} from './settings/schema';
import {
  getApiKeyForProfile,
  getSpeechApiKey as readSpeechApiKey,
  getTavilyApiKey as readTavilyApiKey,
  getVisionApiKey as readVisionApiKey,
  hasApiKeyForProfile as hasStoredOrExternalApiKeyForProfile,
  hasSpeechApiKey as hasStoredOrExternalSpeechApiKey,
  hasTavilyApiKey as hasStoredOrExternalTavilyApiKey,
  hasVisionApiKey as hasStoredOrExternalVisionApiKey,
  setApiKeyForProfile as setStoredApiKeyForProfile,
  setSpeechApiKey as writeSpeechApiKey,
  setTavilyApiKey as writeTavilyApiKey,
  setVisionApiKey as writeVisionApiKey,
} from './settings/secrets';

class SettingsManager {
  private state: PersistedShape = defaults();
  private loaded = false;

  private get statePath(): string {
    return resolve(app.getPath('userData'), STATE_FILE);
  }

  private get externalSettingsPath(): string {
    return resolve(app.getPath('home'), USER_SETTINGS_DIR, STATE_FILE);
  }

  load(): void {
    if (this.loaded) return;
    try {
      if (existsSync(this.statePath)) {
        const raw = readFileSync(this.statePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        this.state = mergePersistedShape(defaults(), parsed);
        this.syncActiveApiToLegacy();
      } else {
        this.syncActiveApiToLegacy();
      }
    } catch (err) {
      console.warn('[settings] 加载失败，使用默认值:', err);
      this.state = defaults();
      this.syncActiveApiToLegacy();
    }
    this.loaded = true;
  }

  private save(): void {
    try {
      writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[settings] 保存失败:', err);
    }
  }

  private get activeProfile(): PersistedApiProfile {
    return this.state.apiProfiles.find((profile) => profile.id === this.state.activeApiProfileId)
      ?? this.state.apiProfiles[0]
      ?? defaultApiProfile();
  }

  private loadExternalSettings(): ExternalSettings | null {
    try {
      return loadExternalSettings(this.externalSettingsPath);
    } catch (error) {
      console.warn('[settings] 外部设置无效，已忽略:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private getExternalApiKeyForProfile(
    profile: PersistedApiProfile,
    externalSettings: ExternalSettings | null = this.loadExternalSettings(),
  ): string {
    return resolveExternalApiKey(externalSettings, {
      profileId: profile.id,
      profileName: profile.name,
    });
  }

  private hasApiKeyForProfile(
    profile: PersistedApiProfile,
    externalSettings: ExternalSettings | null = this.loadExternalSettings(),
  ): boolean {
    return hasStoredOrExternalApiKeyForProfile(profile, externalSettings);
  }

  private syncActiveApiToLegacy(): void {
    if (this.state.apiProfiles.length === 0) {
      this.state.apiProfiles = [defaultApiProfile()];
    }
    if (!this.state.apiProfiles.some((profile) => profile.id === this.state.activeApiProfileId)) {
      this.state.activeApiProfileId = this.state.apiProfiles[0].id;
    }
    const active = this.activeProfile;
    this.state.api = {
      protocol: active.protocol,
      baseUrl: active.baseUrl,
      models: [...active.models],
      defaultModel: active.defaultModel,
      apiKeyEncrypted: active.apiKeyEncrypted,
      apiKeyPlain: active.apiKeyPlain,
    };
  }

  getPublic(): AppSettings {
    const active = this.activeProfile;
    const externalSettings = this.loadExternalSettings();
    return buildPublicSettings({
      active,
      externalSettings,
      hasProfileApiKey: this.hasApiKeyForProfile.bind(this),
      hasSpeechApiKey: this.hasSpeechApiKey.bind(this),
      hasTavilyApiKey: this.hasTavilyApiKey.bind(this),
      hasVisionApiKey: this.hasVisionApiKey.bind(this),
      state: this.state,
    });
  }

  patch(p: AppSettingsPatch): AppSettings {
    if (Array.isArray(p.apiProfiles)) {
      this.patchApiProfiles(p.apiProfiles);
    }
    if (typeof p.activeApiProfileId === 'string') {
      this.setActiveApiProfile(p.activeApiProfileId);
    }
    if (p.api) {
      this.patchActiveApi(p.api);
    }
    if (p.prompt) {
      if (typeof p.prompt.systemPromptOverride === 'string') {
        this.state.prompt.systemPromptOverride = p.prompt.systemPromptOverride;
      }
    }
    if (p.permissions) {
      if (p.permissions.bashExec === 'default' || p.permissions.bashExec === 'auto_review' || p.permissions.bashExec === 'full_access') {
        this.state.permissions.bashExec = p.permissions.bashExec;
      }
      if (Array.isArray(p.permissions.bashWhitelist)) {
        this.state.permissions.bashWhitelist = p.permissions.bashWhitelist.map((s) => s.trim()).filter(Boolean);
      }
      if (p.permissions.skills && Array.isArray(p.permissions.skills.disabled)) {
        const cleaned = p.permissions.skills.disabled.map((s) => s.trim()).filter(Boolean);
        this.state.permissions.skills.disabled = Array.from(new Set(cleaned));
      }
    }
    if (p.compact) {
      if (typeof p.compact.model === 'string') this.state.compact.model = p.compact.model.trim();
      if (typeof p.compact.autoThreshold === 'number') this.state.compact.autoThreshold = Math.max(0.5, Math.min(0.95, p.compact.autoThreshold));
      if (typeof p.compact.keepRecentTurns === 'number') this.state.compact.keepRecentTurns = Math.max(1, Math.min(10, Math.round(p.compact.keepRecentTurns)));
      if (typeof p.compact.contextLimit === 'number') this.state.compact.contextLimit = Math.max(4096, Math.round(p.compact.contextLimit));
    }
    if (p.speech) {
      if (p.speech.provider) this.state.speech.provider = normalizeSpeechProvider(p.speech.provider);
      if (typeof p.speech.baseUrl === 'string') this.state.speech.baseUrl = p.speech.baseUrl.trim() || env.OPENAI_BASE_URL;
      if (typeof p.speech.model === 'string') this.state.speech.model = p.speech.model.trim() || SPEECH_DEFAULT_MODEL;
      if (typeof p.speech.language === 'string') this.state.speech.language = p.speech.language.trim();
      if (typeof p.speech.maxDurationSeconds === 'number') {
        this.state.speech.maxDurationSeconds = Math.max(
          SPEECH_MIN_DURATION_SECONDS,
          Math.min(SPEECH_MAX_DURATION_SECONDS, Math.round(p.speech.maxDurationSeconds)),
        );
      }
    }
    if (p.vision) {
      const oldProvider = this.state.vision.provider;
      if (typeof p.vision.enabled === 'boolean') this.state.vision.enabled = p.vision.enabled;
      if (p.vision.provider) {
        this.state.vision.provider = normalizeVisionProvider(p.vision.provider);
        const providerChanged = this.state.vision.provider !== oldProvider;
        if (providerChanged && typeof p.vision.baseUrl !== 'string') {
          this.state.vision.baseUrl = visionDefaultBaseUrl(this.state.vision.provider);
        }
        if (providerChanged && typeof p.vision.model !== 'string') {
          this.state.vision.model = visionDefaultModel(this.state.vision.provider);
        }
      }
      if (typeof p.vision.baseUrl === 'string') {
        this.state.vision.baseUrl = p.vision.baseUrl.trim() || visionDefaultBaseUrl(this.state.vision.provider);
      }
      if (typeof p.vision.model === 'string') {
        this.state.vision.model = p.vision.model.trim() || visionDefaultModel(this.state.vision.provider);
      }
    }
    this.syncActiveApiToLegacy();
    this.save();
    return this.getPublic();
  }

  private patchApiProfiles(profiles: AppSettingsPatch['apiProfiles']): void {
    if (!profiles || profiles.length === 0) {
      throw new Error('至少保留一个 API 配置');
    }
    const previousById = new Map(this.state.apiProfiles.map((profile) => [profile.id, profile]));
    const seenIds = new Set<string>();
    const nextProfiles = profiles.map((profile, index) => {
      const previous = previousById.get(profile.id);
      const normalized = normalizeProfile(
        {
          ...previous,
          ...profile,
          apiKeyEncrypted: previous?.apiKeyEncrypted,
          apiKeyPlain: previous?.apiKeyPlain,
        },
        index === 0 ? DEFAULT_PROFILE_ID : randomUUID(),
      );
      if (seenIds.has(normalized.id)) {
        throw new Error(`API 配置 ID 重复: ${normalized.id}`);
      }
      seenIds.add(normalized.id);
      return normalized;
    });
    this.state.apiProfiles = nextProfiles;
    if (!nextProfiles.some((profile) => profile.id === this.state.activeApiProfileId)) {
      this.state.activeApiProfileId = nextProfiles[0].id;
    }
  }

  private setActiveApiProfile(id: string): void {
    const nextId = id.trim();
    if (!this.state.apiProfiles.some((profile) => profile.id === nextId)) {
      throw new Error(`API 配置不存在: ${id}`);
    }
    this.state.activeApiProfileId = nextId;
  }

  private patchActiveApi(patch: NonNullable<AppSettingsPatch['api']>): void {
    const nextProfiles = this.state.apiProfiles.map((profile) => {
      if (profile.id !== this.state.activeApiProfileId) return profile;
      const baseUrl = typeof patch.baseUrl === 'string'
        ? patch.baseUrl.trim() || defaultBaseUrl()
        : profile.baseUrl;
      const models = Array.isArray(patch.models)
        ? normalizeModels(patch.models)
        : profile.models;
      const nextDefaultModel = typeof patch.defaultModel === 'string'
        ? patch.defaultModel.trim() || defaultModel()
        : profile.defaultModel;
      return normalizeProfile({ ...profile, baseUrl, models, defaultModel: nextDefaultModel }, profile.id);
    });
    this.state.apiProfiles = nextProfiles;
  }

  setApiKey(plaintext: string): void {
    this.setApiKeyForProfile(this.state.activeApiProfileId, plaintext);
  }

  setApiKeyForProfile(profileId: string, plaintext: string): void {
    setStoredApiKeyForProfile(this.state, profileId, plaintext);
    this.syncActiveApiToLegacy();
    this.save();
  }

  /** 真实可用的 API Key（解密后）；用户未设置时回退到 env */
  getApiKey(): string {
    const active = this.activeProfile;
    return getApiKeyForProfile({
      externalSettings: this.loadExternalSettings(),
      getExternalApiKeyForProfile: this.getExternalApiKeyForProfile.bind(this),
      profile: active,
    });
  }

  /** 用户是否设置了自己的 key（不算 env 兜底） */
  hasUserApiKey(): boolean {
    return this.hasApiKeyForProfile(this.activeProfile);
  }

  getActiveApiCompatibilityError(): string | null {
    const active = this.activeProfile;
    if (active.protocol !== 'legacy-openai') return null;
    return `配置“${active.name}”来自旧版 OpenAI Chat Completions，当前版本仅支持 Anthropic Messages。请在设置中更新 Base URL 与模型，并确认转换后再使用。`;
  }

  assertActiveApiProfileSupported(): void {
    const error = this.getActiveApiCompatibilityError();
    if (error) throw new Error(error);
  }

  setTavilyApiKey(plaintext: string): void {
    writeTavilyApiKey(this.state, plaintext);
    this.save();
  }

  getTavilyApiKey(): string {
    return readTavilyApiKey(this.state, this.loadExternalSettings());
  }

  hasTavilyApiKey(externalSettings: ExternalSettings | null = this.loadExternalSettings()): boolean {
    return hasStoredOrExternalTavilyApiKey(this.state, externalSettings);
  }

  setSpeechApiKey(plaintext: string): void {
    writeSpeechApiKey(this.state, plaintext);
    this.save();
  }

  getSpeechApiKey(): string {
    return readSpeechApiKey(this.state, this.loadExternalSettings());
  }

  hasSpeechApiKey(externalSettings: ExternalSettings | null = this.loadExternalSettings()): boolean {
    return hasStoredOrExternalSpeechApiKey(this.state, externalSettings);
  }

  setVisionApiKey(plaintext: string): void {
    writeVisionApiKey(this.state, plaintext);
    this.save();
  }

  getVisionApiKey(): string {
    return readVisionApiKey({
      externalSettings: this.loadExternalSettings(),
      fallbackApiKey: () => this.getApiKey(),
      provider: this.state.vision.provider,
      state: this.state,
    });
  }

  hasVisionApiKey(externalSettings: ExternalSettings | null = this.loadExternalSettings()): boolean {
    return hasStoredOrExternalVisionApiKey(this.state, externalSettings, this.state.vision.provider);
  }

  getVisionProvider(): VisionProvider {
    return this.state.vision.provider;
  }

  getVisionBaseUrl(): string {
    return this.state.vision.baseUrl || visionDefaultBaseUrl(this.state.vision.provider);
  }

  getVisionModel(): string {
    return this.state.vision.model || visionDefaultModel(this.state.vision.provider);
  }

  getBaseUrl(): string {
    return this.state.api.baseUrl || env.ANTHROPIC_BASE_URL;
  }

  getDefaultModels(): string[] {
    return [...env.ANTHROPIC_MODELS];
  }

  /** 用户自定义模型列表（空表示走自动拉取） */
  getUserModels(): string[] {
    return [...this.state.api.models];
  }

  /** 用户在设置 UI 里写的覆盖文本（trim 前的原文）；空字符串 = 走默认 .md */
  getSystemPromptOverride(): string {
    return this.state.prompt.systemPromptOverride;
  }

  getBashPolicy(): BashExecPolicy {
    return this.state.permissions.bashExec;
  }

  getBashWhitelist(): string[] {
    return [...this.state.permissions.bashWhitelist];
  }

  getDisabledSkills(): string[] {
    return [...this.state.permissions.skills.disabled];
  }

  setSkillEnabled(name: string, enabled: boolean): void {
    const list = this.state.permissions.skills.disabled;
    if (enabled) {
      this.state.permissions.skills.disabled = list.filter((n) => n !== name);
    } else if (!list.includes(name)) {
      list.push(name);
    } else {
      return;
    }
    this.save();
  }

  getCompactModel(): string {
    return this.state.compact.model || this.state.api.defaultModel || 'claude-sonnet-4-6';
  }

  getCompactAutoThreshold(): number {
    return this.state.compact.autoThreshold;
  }

  getCompactKeepRecentTurns(): number {
    return this.state.compact.keepRecentTurns;
  }

  getCompactContextLimit(): number {
    return this.state.compact.contextLimit;
  }

  getSpeechProvider(): SpeechProvider {
    return this.state.speech.provider;
  }

  getSpeechBaseUrl(): string {
    return this.state.speech.baseUrl || env.OPENAI_BASE_URL;
  }

  getSpeechModel(): string {
    return this.state.speech.model || SPEECH_DEFAULT_MODEL;
  }

  getSpeechLanguage(): string {
    return this.state.speech.language;
  }

  getSpeechMaxDurationSeconds(): number {
    return this.state.speech.maxDurationSeconds;
  }

  reset(): AppSettings {
    const apiProfiles = this.state.apiProfiles;
    const activeApiProfileId = this.state.activeApiProfileId;
    const speechApiKeyEncrypted = this.state.speech.apiKeyEncrypted;
    const speechApiKeyPlain = this.state.speech.apiKeyPlain;
    const visionApiKeyEncrypted = this.state.vision.apiKeyEncrypted;
    const visionApiKeyPlain = this.state.vision.apiKeyPlain;
    this.state = defaults();
    this.state.apiProfiles = apiProfiles.length > 0 ? apiProfiles : this.state.apiProfiles;
    this.state.activeApiProfileId = this.state.apiProfiles.some((profile) => profile.id === activeApiProfileId)
      ? activeApiProfileId
      : this.state.apiProfiles[0].id;
    this.state.speech.apiKeyEncrypted = speechApiKeyEncrypted;
    this.state.speech.apiKeyPlain = speechApiKeyPlain;
    this.state.vision.apiKeyEncrypted = visionApiKeyEncrypted;
    this.state.vision.apiKeyPlain = visionApiKeyPlain;
    this.syncActiveApiToLegacy();
    this.save();
    return this.getPublic();
  }
}

export const settingsManager = new SettingsManager();
