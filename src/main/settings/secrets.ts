import { safeStorage } from 'electron';
import type { VisionProvider } from '../../shared/types';
import { env } from '../env';
import {
  resolveExternalApiKey,
  resolveExternalSpeechApiKey,
  resolveExternalTavilyApiKey,
  resolveExternalVisionApiKey,
  type ExternalSettings,
} from '../externalSettings';
import type { PersistedApiProfile, PersistedShape } from './schema';

type SecretPatch = {
  encrypted?: string;
  plain?: string;
};

function encryptSecret(plaintext: string, label: string): SecretPatch | null {
  const trimmed = plaintext.trim();
  if (!trimmed) return null;
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(trimmed);
    return { encrypted: buf.toString('base64'), plain: undefined };
  }
  console.warn(`[settings] safeStorage 不可用，${label} 将以明文存储`);
  return { encrypted: undefined, plain: trimmed };
}

function decryptSecret(encrypted: string | undefined, label: string): string | null {
  if (!encrypted) return null;
  try {
    const buf = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.warn(`[settings] ${label} 解密失败:`, err);
    return null;
  }
}

export function setApiKeyForProfile(state: PersistedShape, profileId: string, plaintext: string): void {
  const index = state.apiProfiles.findIndex((profile) => profile.id === profileId);
  if (index < 0) {
    throw new Error(`API 配置不存在: ${profileId}`);
  }
  const secret = encryptSecret(plaintext, 'API Key');
  state.apiProfiles[index] = {
    ...state.apiProfiles[index],
    apiKeyEncrypted: secret?.encrypted,
    apiKeyPlain: secret?.plain,
  };
}

export function getApiKeyForProfile({
  externalSettings,
  getExternalApiKeyForProfile,
  profile,
}: {
  externalSettings: ExternalSettings | null;
  getExternalApiKeyForProfile: (profile: PersistedApiProfile, externalSettings: ExternalSettings | null) => string;
  profile: PersistedApiProfile;
}): string {
  const decrypted = decryptSecret(profile.apiKeyEncrypted, 'API Key');
  if (decrypted) return decrypted;
  if (profile.apiKeyPlain) return profile.apiKeyPlain;
  const externalApiKey = getExternalApiKeyForProfile(profile, externalSettings);
  if (externalApiKey) return externalApiKey;
  return env.ANTHROPIC_API_KEY;
}

export function setTavilyApiKey(state: PersistedShape, plaintext: string): void {
  const secret = encryptSecret(plaintext, 'Tavily API Key');
  state.search.tavilyApiKeyEncrypted = secret?.encrypted;
  state.search.tavilyApiKeyPlain = secret?.plain;
}

export function getTavilyApiKey(state: PersistedShape, externalSettings: ExternalSettings | null): string {
  return decryptSecret(state.search.tavilyApiKeyEncrypted, 'Tavily API Key')
    || state.search.tavilyApiKeyPlain
    || resolveExternalTavilyApiKey(externalSettings);
}

export function hasTavilyApiKey(state: PersistedShape, externalSettings: ExternalSettings | null): boolean {
  return !!(
    state.search.tavilyApiKeyEncrypted
    || state.search.tavilyApiKeyPlain
    || resolveExternalTavilyApiKey(externalSettings)
  );
}

export function setSpeechApiKey(state: PersistedShape, plaintext: string): void {
  const secret = encryptSecret(plaintext, 'Speech API Key');
  state.speech.apiKeyEncrypted = secret?.encrypted;
  state.speech.apiKeyPlain = secret?.plain;
}

export function getSpeechApiKey(state: PersistedShape, externalSettings: ExternalSettings | null): string {
  const decrypted = decryptSecret(state.speech.apiKeyEncrypted, 'Speech API Key');
  if (decrypted) return decrypted;
  if (state.speech.apiKeyPlain) return state.speech.apiKeyPlain;
  const externalApiKey = resolveExternalSpeechApiKey(externalSettings);
  if (externalApiKey) return externalApiKey;
  return env.OPENAI_API_KEY;
}

export function hasSpeechApiKey(state: PersistedShape, externalSettings: ExternalSettings | null): boolean {
  return !!(
    state.speech.apiKeyEncrypted
    || state.speech.apiKeyPlain
    || resolveExternalSpeechApiKey(externalSettings)
  );
}

export function setVisionApiKey(state: PersistedShape, plaintext: string): void {
  const secret = encryptSecret(plaintext, 'Vision API Key');
  state.vision.apiKeyEncrypted = secret?.encrypted;
  state.vision.apiKeyPlain = secret?.plain;
}

export function getVisionApiKey({
  externalSettings,
  fallbackApiKey,
  provider,
  state,
}: {
  externalSettings: ExternalSettings | null;
  fallbackApiKey: () => string;
  provider: VisionProvider;
  state: PersistedShape;
}): string {
  const decrypted = decryptSecret(state.vision.apiKeyEncrypted, 'Vision API Key');
  if (decrypted) return decrypted;
  if (state.vision.apiKeyPlain) return state.vision.apiKeyPlain;
  const externalApiKey = resolveExternalVisionApiKey(externalSettings, provider);
  return externalApiKey || fallbackApiKey();
}

export function hasVisionApiKey(
  state: PersistedShape,
  externalSettings: ExternalSettings | null,
  provider: VisionProvider,
): boolean {
  return !!(
    state.vision.apiKeyEncrypted
    || state.vision.apiKeyPlain
    || resolveExternalVisionApiKey(externalSettings, provider)
  );
}

export function hasApiKeyForProfile(
  profile: PersistedApiProfile,
  externalSettings: ExternalSettings | null,
): boolean {
  return !!(
    profile.apiKeyEncrypted
    || profile.apiKeyPlain
    || resolveExternalApiKey(externalSettings, {
      profileId: profile.id,
      profileName: profile.name,
    })
  );
}
