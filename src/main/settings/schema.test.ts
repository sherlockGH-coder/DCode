import { describe, expect, it } from 'vitest';
import { defaults, mergePersistedShape } from './schema';

describe('settings schema migration', () => {
  it('migrates legacy OpenAI profiles to Chat Completions', () => {
    const migrated = mergePersistedShape(defaults(), {
      api: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o'],
        defaultModel: 'gpt-4o',
      },
      apiProfiles: [{
        id: 'legacy-openai',
        name: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o'],
        defaultModel: 'gpt-4o',
      }],
      activeApiProfileId: 'legacy-openai',
    } as any);

    expect(migrated.apiProfiles[0]).toMatchObject({
      id: 'legacy-openai',
      protocol: 'chat-completions',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
    });
    expect(migrated.api.protocol).toBe('chat-completions');
  });

  it('treats existing Anthropic and new protocol-less profiles as supported', () => {
    const migrated = mergePersistedShape(defaults(), {
      apiProfiles: [
        {
          id: 'legacy-anthropic',
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          models: [],
          defaultModel: 'claude-sonnet-4-6',
        },
        {
          id: 'current',
          name: 'Current',
          baseUrl: 'https://proxy.example.com',
          models: [],
          defaultModel: 'claude-sonnet-4-6',
        },
        {
          id: 'responses',
          name: 'Responses',
          protocol: 'responses',
          baseUrl: 'https://api.openai.com/v1',
          models: ['gpt-5'],
          defaultModel: 'gpt-5',
        },
      ],
    } as any);

    expect(migrated.apiProfiles.map((profile) => profile.protocol)).toEqual([
      'anthropic',
      'anthropic',
      'responses',
    ]);
  });

  it('preserves a Chat Completions profile when settings are reloaded', () => {
    const reloaded = mergePersistedShape(defaults(), {
      apiProfiles: [{
        id: 'chat-completions',
        name: 'OpenAI Compatible',
        protocol: 'chat-completions',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o'],
        defaultModel: 'gpt-4o',
      }],
      activeApiProfileId: 'chat-completions',
    });

    expect(reloaded.api.protocol).toBe('chat-completions');
    expect(reloaded.apiProfiles[0]).toMatchObject({
      id: 'chat-completions',
      protocol: 'chat-completions',
    });
  });

  it('builds standard DeepSeek default profile', () => {
    const defaultProfile = mergePersistedShape(defaults(), {}).apiProfiles[0];
    expect(defaultProfile).toMatchObject({
      id: 'default',
      name: 'DeepSeek',
      protocol: 'anthropic',
      baseUrl: 'https://api.deepseek.com/anthropic',
      models: ['deepseek-v4-flash'],
      defaultModel: 'deepseek-v4-flash',
    });
  });
});
