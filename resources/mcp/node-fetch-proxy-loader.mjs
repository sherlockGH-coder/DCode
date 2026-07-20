import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRAPPER_PREFIX = 'dcode-node-fetch-proxy:';
const requireFromCwd = createRequire(pathToFileURL(join(process.cwd(), '__deepseek_mcp_loader__.js')));

export async function resolve(specifier, context, defaultResolve) {
  if (specifier !== 'node-fetch') {
    return defaultResolve(specifier, context, defaultResolve);
  }

  let resolved;
  try {
    resolved = await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    resolved = { url: pathToFileURL(requireFromCwd.resolve(specifier)).href };
  }

  return {
    url: `${WRAPPER_PREFIX}${encodeURIComponent(resolved.url)}`,
    shortCircuit: true,
  };
}

export async function load(url, context, defaultLoad) {
  if (!url.startsWith(WRAPPER_PREFIX)) {
    return defaultLoad(url, context, defaultLoad);
  }

  const targetUrl = decodeURIComponent(url.slice(WRAPPER_PREFIX.length));
  return {
    format: 'module',
    shortCircuit: true,
    source: buildWrapperSource(targetUrl),
  };
}

function buildWrapperSource(targetUrl) {
  return `
import originalFetch from ${JSON.stringify(targetUrl)};
export * from ${JSON.stringify(targetUrl)};
import { createRequire } from 'node:module';

const require = createRequire(${JSON.stringify(targetUrl)});
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
  const hostWithPort = port ? host + ':' + port : host;
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

  const key = parsedUrl.protocol + '|' + proxyUrl;
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

export default function fetch(input, init) {
  return originalFetch(input, withProxyAgent(input, init));
}
`;
}
