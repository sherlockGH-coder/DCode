import { existsSync, readFileSync, statSync } from 'node:fs';
import type { VisionProvider } from '../shared/types';

type JsonRecord = Record<string, unknown>;

export interface ExternalSettings {
  root: JsonRecord;
}

export interface ExternalApiKeyContext {
  profileId: string;
  profileName: string;
}

const GENERIC_API_KEY_KEYS = [
  'apiKey',
  'api_key',
  'API_KEY',
  'deepseekApiKey',
  'deepseek_api_key',
  'DEEPSEEK_API_KEY',
];
const OPENAI_API_KEY_KEYS = ['openaiApiKey', 'openai_api_key', 'OPENAI_API_KEY'];
const ANTHROPIC_API_KEY_KEYS = ['anthropicApiKey', 'anthropic_api_key', 'ANTHROPIC_API_KEY'];
const TAVILY_API_KEY_KEYS = ['tavilyApiKey', 'tavily_api_key', 'TAVILY_API_KEY'];
const SPEECH_API_KEY_KEYS = [
  'speechApiKey',
  'speech_api_key',
  'SPEECH_API_KEY',
  ...GENERIC_API_KEY_KEYS,
  ...OPENAI_API_KEY_KEYS,
];
const VISION_API_KEY_KEYS = ['visionApiKey', 'vision_api_key', 'VISION_API_KEY'];

export function loadExternalSettings(filePath: string): ExternalSettings | null {
  if (!existsSync(filePath)) return null;
  if (!statSync(filePath).isFile()) {
    throw new Error(`External settings path is not a file: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`External settings must be a JSON object: ${filePath}`);
  }
  return { root: parsed };
}

export function resolveExternalApiKey(
  settings: ExternalSettings | null,
  context: ExternalApiKeyContext,
): string {
  if (!settings) return '';
  return readProfileApiKey(settings.root, context)
    || readProviderApiKey(settings.root, 'anthropic')
    || readGenericApiKey(settings.root);
}

export function resolveExternalTavilyApiKey(settings: ExternalSettings | null): string {
  if (!settings) return '';
  const search = asRecord(settings.root.search);
  return readString(search, TAVILY_API_KEY_KEYS)
    || readString(settings.root, TAVILY_API_KEY_KEYS)
    || readString(asRecord(settings.root.keys), TAVILY_API_KEY_KEYS);
}

export function resolveExternalSpeechApiKey(settings: ExternalSettings | null): string {
  if (!settings) return '';
  const speech = asRecord(settings.root.speech);
  return readString(speech, SPEECH_API_KEY_KEYS)
    || readString(settings.root, SPEECH_API_KEY_KEYS)
    || readProviderApiKey(settings.root, 'openai');
}

export function resolveExternalVisionApiKey(
  settings: ExternalSettings | null,
  provider: VisionProvider,
): string {
  if (!settings || provider === 'none') return '';
  const vision = asRecord(settings.root.vision);
  return readString(vision, [...VISION_API_KEY_KEYS, ...providerApiKeyNames(provider)])
    || readString(settings.root, VISION_API_KEY_KEYS)
    || readString(asRecord(settings.root.keys), VISION_API_KEY_KEYS);
}

function readProfileApiKey(root: JsonRecord, context: ExternalApiKeyContext): string {
  const fromArray = readProfileArrayApiKey(root.apiProfiles, context);
  if (fromArray) return fromArray;
  const fromRootMap = readProfileMapApiKey(root.apiProfileKeys, context);
  if (fromRootMap) return fromRootMap;
  return readProfileMapApiKey(asRecord(root.api)?.profileKeys, context);
}

function readProfileArrayApiKey(value: unknown, context: ExternalApiKeyContext): string {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const profile = asRecord(item);
    if (!profile || !profileMatches(profile, context)) continue;
    const key = readString(profile, [...GENERIC_API_KEY_KEYS, ...ANTHROPIC_API_KEY_KEYS]);
    if (key) return key;
  }
  return '';
}

function readProfileMapApiKey(value: unknown, context: ExternalApiKeyContext): string {
  const map = asRecord(value);
  const byId = readMappedString(map, context.profileId);
  if (byId) return byId;
  return readMappedString(map, context.profileName);
}

function readProviderApiKey(root: JsonRecord, provider: VisionProvider): string {
  const names = providerApiKeyNames(provider);
  return readString(asRecord(root.api), names)
    || readString(root, names)
    || readString(asRecord(root.keys), names);
}

function readGenericApiKey(root: JsonRecord): string {
  return readString(asRecord(root.api), GENERIC_API_KEY_KEYS)
    || readString(root, GENERIC_API_KEY_KEYS)
    || readString(asRecord(root.keys), GENERIC_API_KEY_KEYS);
}

function providerApiKeyNames(provider: VisionProvider): string[] {
  if (provider === 'openai' || provider === 'custom') return OPENAI_API_KEY_KEYS;
  if (provider === 'anthropic') return ANTHROPIC_API_KEY_KEYS;
  return [];
}

function profileMatches(profile: JsonRecord, context: ExternalApiKeyContext): boolean {
  return profile.id === context.profileId || profile.name === context.profileName;
}

function readMappedString(map: JsonRecord | null, key: string): string {
  if (!map || !key) return '';
  const value = map[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readString(source: JsonRecord | null, keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
