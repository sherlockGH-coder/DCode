import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  loadExternalSettings,
  resolveExternalApiKey,
  resolveExternalSpeechApiKey,
  resolveExternalTavilyApiKey,
  resolveExternalVisionApiKey,
} from './externalSettings';

function writeSettings(contents: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'deepseek-settings-'));
  const filePath = join(dir, 'settings.json');
  writeFileSync(filePath, JSON.stringify(contents), 'utf-8');
  return filePath;
}

describe('external settings', () => {
  it('resolves profile-specific API keys before provider and generic keys', () => {
    const settings = loadExternalSettings(writeSettings({
      api: {
        apiKey: 'generic-key',
        openaiApiKey: 'openai-key',
      },
      apiProfiles: [
        { id: 'default', apiKey: 'profile-key' },
      ],
    }));

    expect(resolveExternalApiKey(settings, {
      profileId: 'default',
      profileName: '默认配置',
    })).toBe('profile-key');
  });

  it('falls back from provider API keys to generic API keys', () => {
    const providerSettings = loadExternalSettings(writeSettings({
      ANTHROPIC_API_KEY: 'anthropic-key',
      API_KEY: 'generic-key',
    }));
    const genericSettings = loadExternalSettings(writeSettings({
      API_KEY: 'generic-key',
    }));

    expect(resolveExternalApiKey(providerSettings, {
      profileId: 'missing',
      profileName: 'missing',
    })).toBe('anthropic-key');
    expect(resolveExternalApiKey(genericSettings, {
      profileId: 'missing',
      profileName: 'missing',
    })).toBe('generic-key');
  });

  it('resolves dedicated Tavily, speech, and vision keys', () => {
    const settings = loadExternalSettings(writeSettings({
      search: { tavilyApiKey: 'tavily-key' },
      speech: { apiKey: 'speech-key' },
      vision: { anthropicApiKey: 'vision-key' },
    }));

    expect(resolveExternalTavilyApiKey(settings)).toBe('tavily-key');
    expect(resolveExternalSpeechApiKey(settings)).toBe('speech-key');
    expect(resolveExternalVisionApiKey(settings, 'anthropic')).toBe('vision-key');
  });

  it('returns null when the external settings file does not exist', () => {
    expect(loadExternalSettings(join(tmpdir(), 'deepseek-missing-settings.json'))).toBeNull();
  });
});
