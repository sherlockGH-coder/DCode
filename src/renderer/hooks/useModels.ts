import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

const FALLBACK = ['deepseek-chat', 'deepseek-reasoner'];

function withSelectedModel(list: string[], selectedModel: string): string[] {
  const model = selectedModel.trim();
  if (!model || list.includes(model)) return list;
  return [model, ...list];
}

export function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [ready, setReady] = useState(false);
  const selectedModelRef = useRef('deepseek-chat');

  const lastKeyRef = useRef<string>('');

  const fetchModels = useCallback(async (preferredModel?: string) => {
    const list = await window.dcodeApi.getModels().catch(() => FALLBACK);
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

    (async () => {
      const [modelList, settings] = await Promise.all([
        window.dcodeApi.getModels().catch(() => FALLBACK),
        window.dcodeApi.getSettings().catch(() => null),
      ]);

      if (cancelled) return;

      if (settings) {
        lastKeyRef.current = `${settings.api.baseUrl}|${settings.api.apiKeySet}|${settings.api.models.join(',')}`;
      }

      let defaultModel = settings?.api?.defaultModel || '';

      if (!defaultModel) {
        try {
          const legacy = localStorage.getItem('selected-model');
          if (legacy) {
            defaultModel = legacy;
            await window.dcodeApi.patchSettings({ api: { defaultModel: legacy } });
          }
        } catch {              }
      }

      if (!defaultModel) defaultModel = 'deepseek-chat';

      setModels(withSelectedModel(modelList, defaultModel));
      setSelectedModel(defaultModel);
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = window.dcodeApi.onSettingsChanged((s) => {
      const nextKey = `${s.api.baseUrl}|${s.api.apiKeySet}|${s.api.models.join(',')}`;
      if (nextKey !== lastKeyRef.current) {
        lastKeyRef.current = nextKey;
        fetchModels(s.api.defaultModel);
      }

      setSelectedModel((prev) => {
        if (s.api.defaultModel && s.api.defaultModel !== prev) {
          setModels((current) => withSelectedModel(current, s.api.defaultModel));
          return s.api.defaultModel;
        }
        return prev;
      });
    });
    return unsub;
  }, [fetchModels]);

  useEffect(() => {
    const handler = () => {
      window.dcodeApi.getSettings()
        .then((settings) => fetchModels(settings.api.defaultModel))
        .catch(() => fetchModels());
    };
    window.addEventListener('models:refresh', handler);
    return () => window.removeEventListener('models:refresh', handler);
  }, [fetchModels]);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    setModels((current) => withSelectedModel(current, model));

    window.dcodeApi.patchSettings({ api: { defaultModel: model } }).catch(() => {});

    try { localStorage.setItem('selected-model', model); } catch {              }
  }, []);

  return useMemo(() => ({
    models,
    selectedModel,
    handleModelChange,
    ready
  }), [models, selectedModel, handleModelChange, ready]);
}
