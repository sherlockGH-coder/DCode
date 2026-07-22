import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../shared/types';
import { useModels } from './useModels';

const OLD_MODEL = 'deepseek-v4-flash';
const NEW_MODEL = '@cf/moonshotai/kimi-k2.7-code';

function makeSettings(model: string, models: string[], profileId: string): AppSettings {
  return {
    schemaVersion: 1,
    api: {
      protocol: 'anthropic',
      baseUrl: `https://example.com/${profileId}/v1`,
      models,
      defaultModel: model,
      apiKeySet: true,
    },
    apiProfiles: [{
      id: profileId,
      name: profileId,
      protocol: 'anthropic',
      baseUrl: `https://example.com/${profileId}/v1`,
      models,
      defaultModel: model,
      apiKeySet: true,
    }],
    activeApiProfileId: profileId,
    prompt: { systemPromptOverride: '' },
    permissions: {
      bashExec: 'default',
      bashWhitelist: [],
      skills: { disabled: [] },
    },
    search: { tavilyApiKeySet: false },
    compact: {
      model: '',
      autoThreshold: 0.8,
      keepRecentTurns: 3,
      contextLimit: 262144,
    },
    speech: {
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'whisper-1',
      language: '',
      maxDurationSeconds: 60,
      apiKeySet: false,
    },
    vision: {
      enabled: false,
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-6',
      apiKeySet: false,
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useModels', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let settingsChanged: ((settings: AppSettings) => void) | undefined;
  let activeModels: string[];

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    activeModels = [OLD_MODEL];
    settingsChanged = undefined;
    (window as any).deepseekApi = {
      getModels: vi.fn(async () => activeModels),
      getSettings: vi.fn(async () => makeSettings(OLD_MODEL, [OLD_MODEL], 'old')),
      patchSettings: vi.fn(),
      onSettingsChanged: vi.fn((callback: (settings: AppSettings) => void) => {
        settingsChanged = callback;
        return vi.fn();
      }),
    };

    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await flushAsyncWork();
    });
    root = null;
    vi.restoreAllMocks();
  });

  it('drops the previous profile model after switching API profiles', async () => {
    let current: ReturnType<typeof useModels> | undefined;
    const Harness = () => {
      current = useModels();
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });
    await act(async () => {
      await flushAsyncWork();
    });

    expect(current?.ready).toBe(true);
    expect(current?.selectedModel).toBe(OLD_MODEL);
    expect(current?.models).toEqual([OLD_MODEL]);
    expect(settingsChanged).toBeTypeOf('function');

    activeModels = [NEW_MODEL];
    await act(async () => {
      settingsChanged?.(makeSettings(NEW_MODEL, [NEW_MODEL], 'new'));
    });
    await act(async () => {
      await flushAsyncWork();
    });

    expect(current?.selectedModel).toBe(NEW_MODEL);
    expect(current?.models).toEqual([NEW_MODEL]);
  });
});
