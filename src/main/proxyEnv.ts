import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROXY_ENV_KEY_SET = new Set([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'npm_config_proxy',
  'npm_config_https_proxy',
  'npm_config_noproxy',
]);

export const PROXY_ENV_KEYS = Array.from(PROXY_ENV_KEY_SET);
const MCP_NODE_FETCH_PROXY_LOADER = join('mcp', 'node-fetch-proxy-loader.mjs');
const MCP_FETCH_PROXY_PRELOAD = join('mcp', 'fetch-proxy-preload.mjs');

function isSafeEnvValue(value: string): boolean {
  return value.trim().length > 0 && !value.startsWith('()');
}

function resolveMcpResourcePath(relativePath: string): string | null {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  const resourcesPath = typeof electronProcess.resourcesPath === 'string' ? electronProcess.resourcesPath : '';
  const candidates = [
    resourcesPath ? join(resourcesPath, relativePath) : '',
    resourcesPath ? join(resourcesPath, 'resources', relativePath) : '',
    join(process.cwd(), 'resources', relativePath),
  ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function appendNodeOption(existing: string | undefined, option: string): string {
  const normalized = existing?.trim();
  if (!normalized) return option;
  if (normalized.includes(option)) return normalized;
  return `${normalized} ${option}`;
}

function withNodeFetchProxyLoader(env: Record<string, string>): Record<string, string> {
  if (Object.keys(collectProxyEnvironment(env)).length === 0) return env;

  const loaderPath = resolveMcpResourcePath(MCP_NODE_FETCH_PROXY_LOADER);
  const preloadPath = resolveMcpResourcePath(MCP_FETCH_PROXY_PRELOAD);
  if (!loaderPath || !preloadPath) return env;

  const loaderOption = `--experimental-loader=${pathToFileURL(loaderPath).href}`;
  const preloadOption = `--import=${pathToFileURL(preloadPath).href}`;
  return {
    ...env,
    DCODE_MCP_NODE_FETCH_PROXY: '1',
    NODE_OPTIONS: appendNodeOption(
      appendNodeOption(env.NODE_OPTIONS, loaderOption),
      preloadOption,
    ),
  };
}

export function collectProxyEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PROXY_ENV_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && isSafeEnvValue(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function mergeProxyEnvironment(
  explicitEnv: Record<string, string> | undefined,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> | undefined {
  const proxyEnv = collectProxyEnvironment(source);
  const merged = explicitEnv ? { ...proxyEnv, ...explicitEnv } : proxyEnv;
  if (Object.keys(merged).length === 0) return undefined;
  return withNodeFetchProxyLoader(merged);
}
