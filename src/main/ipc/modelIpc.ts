import { ipcMain } from 'electron';
import { settingsManager } from '../settings';

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
let cachedModels: string[] | null = null;
let cacheTimestamp = 0;
let cacheKey = '';

function getCacheKey(): string {
  return `${settingsManager.getBaseUrl()}|${settingsManager.getApiKey()}`;
}

/** 使缓存失效（设置变更时调用） */
export function invalidateModelCache(): void {
  cachedModels = null;
  cacheTimestamp = 0;
  cacheKey = '';
}

/**
 * 从 baseURL 构建 /v1/models 的完整 URL
 * 规则：去掉 /v1 或 /anthropic 后缀（如果有），再拼接 /v1/models
 */
function buildModelsUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');

  if (url.endsWith('/v1')) {
    url = url.slice(0, -3);
  }

  if (url.endsWith('/anthropic')) {
    url = url.slice(0, -10);
  }
  return `${url}/v1/models`;
}

async function fetchAvailableModels(): Promise<string[]> {
  const defaultModels = settingsManager.getDefaultModels();

  const userModels = settingsManager.getUserModels();
  if (userModels.length > 0) return userModels;

  const compatibilityError = settingsManager.getActiveApiCompatibilityError();
  if (compatibilityError) {
    console.warn(`[models] ${compatibilityError}`);
    return defaultModels;
  }

  const currentKey = getCacheKey();
  if (cachedModels && cacheKey === currentKey && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedModels;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const modelsUrl = buildModelsUrl(settingsManager.getBaseUrl());
    const apiKey = settingsManager.getApiKey();

    const authHeaders: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    const response = await fetch(modelsUrl, {
      signal: controller.signal,
      headers: {
        ...authHeaders,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[models] 请求失败: HTTP ${response.status}`);
      return defaultModels;
    }

    const data = await response.json() as any;
    const models: string[] = [];

    if (Array.isArray(data?.data)) {
      for (const model of data.data) {
        if (model.id) models.push(model.id);
      }
    } else if (Array.isArray(data)) {

      for (const model of data) {
        if (model.id) models.push(model.id);
      }
    }

    if (models.length === 0) {
      console.warn('[models] API 返回空列表，使用默认列表');
      return defaultModels;
    }

    cachedModels = models;
    cacheTimestamp = Date.now();
    cacheKey = currentKey;
    return models;
  } catch (err) {
    console.warn('[models] 请求失败:', (err as Error)?.message);
    return defaultModels;
  } finally {
    clearTimeout(timeout);
  }
}

export function registerModelIpc(): void {
  ipcMain.handle('chat:getModels', async () => {
    return fetchAvailableModels();
  });
}
