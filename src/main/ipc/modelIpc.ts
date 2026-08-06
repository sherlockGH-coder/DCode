import { ipcMain } from 'electron';
import { settingsManager } from '../settings';

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface CacheEntry {
  models: string[];
  timestamp: number;
}

const profileCache = new Map<string, CacheEntry>();

/** Invalidate the cache when settings change. */
export function invalidateModelCache(): void {
  profileCache.clear();
}

/**
 * Build the complete /v1/models URL from baseURL.
 * Remove a trailing /v1 or /anthropic suffix when present, then append /v1/models.
 */
function buildModelsUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');

  if (url.endsWith('/models')) {
    return url;
  }

  if (url.endsWith('/v1')) {
    url = url.slice(0, -3);
  } else if (url.endsWith('/anthropic')) {
    url = url.slice(0, -10);
  }
  return `${url}/v1/models`;
}

/** Probe available models for a specific profile ID using its configured baseUrl and API key. */
export async function fetchModelsForProfileId(profileId: string): Promise<string[]> {
  const profile = settingsManager.getProfileById(profileId);
  if (!profile) return settingsManager.getDefaultModels();

  // If the profile has explicitly defined models, return them immediately
  if (profile.models && profile.models.length > 0) {
    return profile.models;
  }

  const baseUrl = profile.baseUrl || settingsManager.getBaseUrl();
  const apiKey = settingsManager.getApiKeyForProfileId(profileId);

  const cacheKey = `${profileId}|${baseUrl}|${apiKey}`;
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.models;
  }

  const fallback = profile.defaultModel ? [profile.defaultModel] : settingsManager.getDefaultModels();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const modelsUrl = buildModelsUrl(baseUrl);
    const authHeaders: Record<string, string> = {
      'anthropic-version': '2023-06-01',
    };
    if (apiKey) {
      authHeaders['Authorization'] = `Bearer ${apiKey}`;
      authHeaders['x-api-key'] = apiKey;
    }

    const response = await fetch(modelsUrl, {
      signal: controller.signal,
      headers: {
        ...authHeaders,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[models] Probing ${profile.name} (${modelsUrl}) failed: HTTP ${response.status}`);
      return fallback;
    }

    const data = await response.json();
    const models: string[] = [];

    const rawList = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
      ? data.models
      : Array.isArray(data)
      ? data
      : [];

    for (const item of rawList) {
      if (typeof item === 'string' && item.trim()) {
        models.push(item.trim());
      } else if (item && typeof item.id === 'string' && item.id.trim()) {
        models.push(item.id.trim());
      }
    }

    if (models.length === 0) {
      console.warn(`[models] Probing ${profile.name} returned empty list; using fallback [${fallback.join(', ')}]`);
      return fallback;
    }

    profileCache.set(cacheKey, { models, timestamp: Date.now() });
    return models;
  } catch (err) {
    console.warn(`[models] Probing ${profile.name} failed:`, (err as Error)?.message);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch models for all enabled providers. */
export async function fetchAllProviderModels(): Promise<{
  profileId: string;
  providerName: string;
  models: string[];
  isActive: boolean;
}[]> {
  const settings = settingsManager.getPublic();
  const enabledProfiles = settingsManager.getEnabledProfiles();

  const results = await Promise.all(
    enabledProfiles.map(async (profile) => {
      const models = await fetchModelsForProfileId(profile.id);
      return {
        profileId: profile.id,
        providerName: profile.name,
        models,
        isActive: profile.id === settings.activeApiProfileId,
      };
    }),
  );

  return results;
}

export function registerModelIpc(): void {
  ipcMain.handle('chat:getModels', async () => {
    const active = settingsManager.getPublic().activeApiProfileId;
    return fetchModelsForProfileId(active);
  });

  ipcMain.handle('chat:getProviderModels', async () => {
    return fetchAllProviderModels();
  });
}
