import { describe, expect, it } from 'vitest';
import { collectProxyEnvironment, mergeProxyEnvironment } from './proxyEnv';

describe('proxy environment', () => {
  it('collects proxy variables from a shell-like environment', () => {
    expect(collectProxyEnvironment({
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      http_proxy: 'http://127.0.0.1:7890',
      PATH: '/usr/bin',
      ALL_PROXY: '',
      NO_PROXY: 'localhost,127.0.0.1',
    })).toEqual({
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      http_proxy: 'http://127.0.0.1:7890',
      NO_PROXY: 'localhost,127.0.0.1',
    });
  });

  it('lets explicit MCP env override inherited proxy values', () => {
    const env = mergeProxyEnvironment(
      {
        HTTPS_PROXY: 'http://override.proxy:8080',
        VISION_API_KEY: 'secret',
      },
      {
        HTTP_PROXY: 'http://127.0.0.1:7890',
        HTTPS_PROXY: 'http://127.0.0.1:7890',
      },
    );

    expect(env).toMatchObject({
      HTTP_PROXY: 'http://127.0.0.1:7890',
      HTTPS_PROXY: 'http://override.proxy:8080',
      VISION_API_KEY: 'secret',
      DCODE_MCP_NODE_FETCH_PROXY: '1',
    });
    expect(env?.NODE_OPTIONS).toContain('--experimental-loader=');
    expect(env?.NODE_OPTIONS).toContain('node-fetch-proxy-loader.mjs');
    expect(env?.NODE_OPTIONS).toContain('--import=');
    expect(env?.NODE_OPTIONS).toContain('fetch-proxy-preload.mjs');
  });

  it('preserves existing NODE_OPTIONS when enabling the node-fetch proxy loader', () => {
    const env = mergeProxyEnvironment(
      { NODE_OPTIONS: '--trace-warnings' },
      { HTTPS_PROXY: 'http://127.0.0.1:7890' },
    );

    expect(env?.NODE_OPTIONS).toContain('--trace-warnings');
    expect(env?.NODE_OPTIONS).toContain('--experimental-loader=');
    expect(env?.NODE_OPTIONS).toContain('--import=');
  });
});
