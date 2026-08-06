import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

const FALLBACK = ['deepseek-chat', 'deepseek-reasoner'];

export interface ProviderModels {
  profileId: string;
  providerName: string;
  models: string[];
  isActive: boolean;
}

function withSelectedModel(list: string[], selectedModel: string): string[] {
  const model = selectedModel.trim();
  if (!model || list.includes(model)) return list;
  return [model, ...list];
}

export function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [providers, setProviders] = useState<ProviderModels[]>([]);
  const [ready, setReady] = useState(false);
  const selectedModelRef = useRef('deepseek-chat');

  const lastKeyRef = useRef<string>('');

  /** Fetch provider-grouped models from IPC backend (which probes API endpoints if profile.models is empty). */
  const refreshProviders = useCallback(async (settings?: Awaited<ReturnType<typeof window.deepseekApi.getSettings>>) => {
    try {
      let providerList: ProviderModels[] = [];
      if (typeof window.deepseekApi.getProviderModels === 'function') {
        providerList = await window.deepseekApi.getProviderModels();
      }

      if ((!providerList || providerList.length === 0) && settings) {
        const enabledIds = new Set(settings.enabledApiProfileIds ?? [settings.activeApiProfileId]);
        const enabledProfiles = settings.apiProfiles.filter((p) => enabledIds.has(p.id));

        providerList = enabledProfiles.map((profile) => ({
          profileId: profile.id,
          providerName: profile.name,
          models: profile.models.length > 0 ? [...profile.models] : (profile.defaultModel ? [profile.defaultModel] : FALLBACK),
          isActive: profile.id === settings.activeApiProfileId,
        }));
      }

      setProviders(providerList);

      const activeProvider = providerList.find((p) => p.isActive);
      if (activeProvider) {
        setSelectedProvider(activeProvider.providerName);
      }

      const allModels = providerList.flatMap((p) => p.models);
      const uniqueModels = Array.from(new Set(allModels));
      return { providerList, uniqueModels };
    } catch {
      return { providerList: [], uniqueModels: [] };
    }
  }, []);

  const fetchModels = useCallback(async (preferredModel?: string) => {
    const list = await window.deepseekApi.getModels().catch(() => FALLBACK);
    const next = preferredModel?.trim() || selectedModelRef.current || list[0] || 'deepseek-chat';
    setModels(withSelectedModel(list, next));
    setSelectedModel(next);
    return list;
  }, []);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [modelList, settings] = await Promise.all([
        window.deepseekApi.getModels().catch(() => FALLBACK),
        window.deepseekApi.getSettings().catch(() => null),
      ]);

      if (cancelled) return;

      if (settings) {
        lastKeyRef.current = `${settings.api.baseUrl}|${settings.api.apiKeySet}|${settings.api.models.join(',')}`;
        const { uniqueModels } = await refreshProviders(settings);

        let defaultModel = settings.api?.defaultModel || '';
        if (!defaultModel) {
          try {
            const legacy = localStorage.getItem('selected-model');
            if (legacy) {
              defaultModel = legacy;
              await window.deepseekApi.patchSettings({ api: { defaultModel: legacy } });
            }
          } catch {}
        }
        if (!defaultModel) defaultModel = 'deepseek-chat';

        setModels(withSelectedModel(uniqueModels.length > 0 ? uniqueModels : modelList, defaultModel));
        setSelectedModel(defaultModel);
      } else {
        let defaultModel = 'deepseek-chat';
        try {
          const legacy = localStorage.getItem('selected-model');
          if (legacy) defaultModel = legacy;
        } catch {}

        setModels(withSelectedModel(modelList, defaultModel));
        setSelectedModel(defaultModel);
      }

      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [refreshProviders]);

  useEffect(() => {
    const unsub = window.deepseekApi.onSettingsChanged((s) => {
      const nextKey = `${s.api.baseUrl}|${s.api.apiKeySet}|${s.api.models.join(',')}`;

      void (async () => {
        const { uniqueModels } = await refreshProviders(s);

        if (nextKey !== lastKeyRef.current) {
          lastKeyRef.current = nextKey;
          void fetchModels(s.api.defaultModel);
        }

        setSelectedModel((prev) => {
          if (s.api.defaultModel && s.api.defaultModel !== prev) {
            setModels((current) => withSelectedModel(
              uniqueModels.length > 0 ? uniqueModels : current,
              s.api.defaultModel,
            ));
            return s.api.defaultModel;
          }
          return prev;
        });

        const activeProfile = s.apiProfiles.find((p) => p.id === s.activeApiProfileId);
        if (activeProfile) {
          setSelectedProvider(activeProfile.name);
        }
      })();
    });
    return unsub;
  }, [fetchModels, refreshProviders]);

  useEffect(() => {
    const handler = () => {
      window.deepseekApi.getSettings()
        .then(async (settings) => {
          await refreshProviders(settings);
          return fetchModels(settings.api.defaultModel);
        })
        .catch(() => fetchModels());
    };
    window.addEventListener('models:refresh', handler);
    return () => window.removeEventListener('models:refresh', handler);
  }, [fetchModels, refreshProviders]);

  const handleModelChange = useCallback((model: string, profileId?: string) => {
    setSelectedModel(model);
    setModels((current) => withSelectedModel(current, model));

    if (profileId) {
      window.deepseekApi.patchSettings({
        activeApiProfileId: profileId,
        api: { defaultModel: model },
      }).then(() => {
        return window.deepseekApi.getSettings();
      }).then(async (settings) => {
        const activeProfile = settings.apiProfiles.find((p) => p.id === settings.activeApiProfileId);
        if (activeProfile) {
          setSelectedProvider(activeProfile.name);
        }
        await refreshProviders(settings);
      }).catch(() => {});
    } else {
      window.deepseekApi.patchSettings({ api: { defaultModel: model } }).catch(() => {});
    }

    try { localStorage.setItem('selected-model', model); } catch {}
  }, [refreshProviders]);

  return useMemo(() => ({
    models,
    selectedModel,
    selectedProvider,
    providers,
    handleModelChange,
    ready
  }), [models, selectedModel, selectedProvider, providers, handleModelChange, ready]);
}
