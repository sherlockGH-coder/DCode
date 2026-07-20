import Anthropic from '@anthropic-ai/sdk';
import { settingsManager } from './settings';

/**
 * 创建 Anthropic API 客户端
 * 每次调用都从 settingsManager 读取最新配置，确保设置变更即时生效
 */
export function createAnthropicClient(): Anthropic {
  settingsManager.assertActiveApiProfileSupported();
  return new Anthropic({
    baseURL: settingsManager.getBaseUrl(),
    apiKey: settingsManager.getApiKey(),
  });
}
