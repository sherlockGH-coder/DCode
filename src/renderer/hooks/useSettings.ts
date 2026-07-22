import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, AppSettingsPatch } from '../../shared/types';

interface UseSettingsResult {
  settings: AppSettings | null;
  isLoading: boolean;
  patch: (p: AppSettingsPatch) => Promise<AppSettings | undefined>;
  setApiKey: (key: string) => Promise<void>;
  setApiProfileApiKey: (profileId: string, key: string) => Promise<void>;
  setTavilyApiKey: (key: string) => Promise<void>;
  setSpeechApiKey: (key: string) => Promise<void>;
  setVisionApiKey: (key: string) => Promise<void>;
  reset: () => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.deepseekApi.getSettings().then((s) => {
      setSettings(s);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const unsub = window.deepseekApi.onSettingsChanged((s) => {
      setSettings(s);
    });
    return unsub;
  }, []);

  const patch = useCallback(async (p: AppSettingsPatch): Promise<AppSettings | undefined> => {
    try {
      const updated = await window.deepseekApi.patchSettings(p);
      setSettings(updated);
      return updated;
    } catch (err) {
      console.error('[useSettings] patch failed:', err);
      throw err;
    }
  }, []);

  const setApiKey = useCallback(async (key: string): Promise<void> => {
    try {
      await window.deepseekApi.setApiKey(key);
      const updated = await window.deepseekApi.getSettings();
      setSettings(updated);
    } catch (err) {
      console.error('[useSettings] setApiKey failed:', err);
      throw err;
    }
  }, []);

  const setApiProfileApiKey = useCallback(async (profileId: string, key: string): Promise<void> => {
    try {
      await window.deepseekApi.setApiProfileApiKey(profileId, key);
      const updated = await window.deepseekApi.getSettings();
      setSettings(updated);
    } catch (err) {
      console.error('[useSettings] setApiProfileApiKey failed:', err);
      throw err;
    }
  }, []);

  const setTavilyApiKey = useCallback(async (key: string): Promise<void> => {
    try {
      await window.deepseekApi.setTavilyApiKey(key);
      const updated = await window.deepseekApi.getSettings();
      setSettings(updated);
    } catch (err) {
      console.error('[useSettings] setTavilyApiKey failed:', err);
      throw err;
    }
  }, []);

  const setSpeechApiKey = useCallback(async (key: string): Promise<void> => {
    try {
      await window.deepseekApi.setSpeechApiKey(key);
      const updated = await window.deepseekApi.getSettings();
      setSettings(updated);
    } catch (err) {
      console.error('[useSettings] setSpeechApiKey failed:', err);
      throw err;
    }
  }, []);

  const setVisionApiKey = useCallback(async (key: string): Promise<void> => {
    try {
      await window.deepseekApi.setVisionApiKey(key);
      const updated = await window.deepseekApi.getSettings();
      setSettings(updated);
    } catch (err) {
      console.error('[useSettings] setVisionApiKey failed:', err);
      throw err;
    }
  }, []);

  const reset = useCallback(async (): Promise<void> => {
    const updated = await window.deepseekApi.resetSettings();
    setSettings(updated);
  }, []);

  return { settings, isLoading, patch, setApiKey, setApiProfileApiKey, setTavilyApiKey, setSpeechApiKey, setVisionApiKey, reset };
}
