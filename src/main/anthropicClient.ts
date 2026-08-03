import Anthropic from '@anthropic-ai/sdk';
import { settingsManager } from './settings';

/**
 * Create the Anthropic API client.
 * Read the latest settingsManager configuration on every call so changes take effect immediately.
 */
export function createAnthropicClient(): Anthropic {
  settingsManager.assertActiveApiProfileSupported();
  return new Anthropic({
    baseURL: settingsManager.getBaseUrl(),
    apiKey: settingsManager.getApiKey(),
  });
}
