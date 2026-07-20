import { describe, expect, it } from 'vitest';
import { defaults, mergePersistedShape } from './schema';

describe('settings schema migration', () => {
  it('preserves legacy OpenAI profiles but marks them as incompatible', () => {
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
      protocol: 'legacy-openai',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
    });
    expect(migrated.api.protocol).toBe('legacy-openai');
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
      ],
    } as any);

    expect(migrated.apiProfiles.map((profile) => profile.protocol)).toEqual([
      'anthropic',
      'anthropic',
    ]);
  });
});
