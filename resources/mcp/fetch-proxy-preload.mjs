import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

let proxiedFetchPromise;

globalThis.fetch = function fetchWithProxy(input, init) {
  proxiedFetchPromise ??= loadProxiedFetch();
  return proxiedFetchPromise.then((fetch) => fetch(input, init));
};

async function loadProxiedFetch() {
  const nodeFetchUrl = pathToFileURL(resolveNodeFetchEntry()).href;
  const nodeFetch = await import(nodeFetchUrl);
  const require = createRequire(nodeFetchUrl);
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const { HttpProxyAgent } = require('http-proxy-agent');
  const agents = new Map();

  function readEnv(keys) {
    for (const key of keys) {
      const value = process.env[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function requestUrl(input) {
    if (typeof input === 'string' || input instanceof URL) return String(input);
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function shouldBypassProxy(hostname, port) {
    const noProxy = readEnv(['NO_PROXY', 'no_proxy', 'npm_config_noproxy']);
    if (!noProxy || !hostname) return false;

    const host = hostname.toLowerCase();
    const hostWithPort = port ? `${host}:${port}` : host;
    for (const rawRule of noProxy.split(',')) {
      const rule = rawRule.trim().toLowerCase();
      if (!rule) continue;
      if (rule === '*') return true;
      if (rule === host || rule === hostWithPort) return true;
      if (rule.startsWith('*.') && host.endsWith(rule.slice(1))) return true;
      if (rule.startsWith('.') && (host === rule.slice(1) || host.endsWith(rule))) return true;
    }
    return false;
  }

  function proxyUrlFor(parsedUrl) {
    const protocol = parsedUrl.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') return '';
    if (shouldBypassProxy(parsedUrl.hostname, parsedUrl.port)) return '';

    if (protocol === 'https:') {
      return readEnv([
        'HTTPS_PROXY',
        'https_proxy',
        'ALL_PROXY',
        'all_proxy',
        'HTTP_PROXY',
        'http_proxy',
        'npm_config_https_proxy',
        'npm_config_proxy',
      ]);
    }

    return readEnv([
      'HTTP_PROXY',
      'http_proxy',
      'ALL_PROXY',
      'all_proxy',
      'npm_config_proxy',
    ]);
  }

  function proxyAgentFor(parsedUrl) {
    const proxyUrl = proxyUrlFor(parsedUrl);
    if (!proxyUrl) return undefined;

    const key = `${parsedUrl.protocol}|${proxyUrl}`;
    let agent = agents.get(key);
    if (!agent) {
      agent = parsedUrl.protocol === 'https:'
        ? new HttpsProxyAgent(proxyUrl)
        : new HttpProxyAgent(proxyUrl);
      agents.set(key, agent);
    }
    return agent;
  }

  function withProxyAgent(input, init) {
    if (init?.agent) return init;

    const rawUrl = requestUrl(input);
    if (!rawUrl) return init;

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return init;
    }

    const agent = proxyAgentFor(parsedUrl);
    if (!agent) return init;

    return {
      ...(init ?? {}),
      agent,
    };
  }

  return (input, init) => nodeFetch.default(input, withProxyAgent(input, init));
}

function resolveNodeFetchEntry() {
  const requirePaths = cwdSearchPaths();
  for (const basePath of requirePaths) {
    try {
      return createRequire(pathToFileURL(join(basePath, '__deepseek_mcp_preload__.js'))).resolve('node-fetch');
    } catch {
      // try next path
    }
  }

  const candidates = findNpxNodeFetchCandidates();
  if (candidates.length > 0) return candidates[0].entry;

  throw new Error('Unable to locate node-fetch for MCP proxy preload');
}

function cwdSearchPaths() {
  const paths = [];
  let current = process.cwd();
  while (current && current !== dirname(current)) {
    paths.push(current);
    current = dirname(current);
  }
  return paths;
}

function findNpxNodeFetchCandidates() {
  const npxRoot = join(homedir(), '.npm', '_npx');
  if (!existsSync(npxRoot)) return [];

  const candidates = [];
  for (const entry of readdirSync(npxRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(npxRoot, entry.name, 'node_modules', 'node-fetch', 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const packageDir = dirname(packageJsonPath);
      const main = typeof packageJson.main === 'string' ? packageJson.main : 'src/index.js';
      const nodeFetchEntry = join(packageDir, main);
      if (!existsSync(nodeFetchEntry)) continue;
      candidates.push({
        entry: nodeFetchEntry,
        mtimeMs: statSync(packageJsonPath).mtimeMs,
      });
    } catch {
      // ignore malformed cache entries
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates;
}
