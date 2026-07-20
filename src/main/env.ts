import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { app } from 'electron';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_MODELS: string[];
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODELS: string[];
  VISION_CUSTOM_BASE_URL: string;
  VISION_CUSTOM_MODEL: string;
}

function loadEnv(): Record<string, string> {

  const envPath = join(process.cwd(), '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const rawEnv = loadEnv();

export const env: Env = {
  ANTHROPIC_API_KEY: rawEnv.ANTHROPIC_API_KEY || '',
  ANTHROPIC_BASE_URL: rawEnv.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  ANTHROPIC_MODELS: rawEnv.ANTHROPIC_MODELS
    ? rawEnv.ANTHROPIC_MODELS.split(',').map(m => m.trim())
    : ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  OPENAI_API_KEY: rawEnv.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: rawEnv.OPENAI_BASE_URL || 'https://api.openai.com',
  OPENAI_MODELS: rawEnv.OPENAI_MODELS
    ? rawEnv.OPENAI_MODELS.split(',').map(m => m.trim())
    : ['gpt-4o', 'gpt-4o-mini'],
  VISION_CUSTOM_BASE_URL: rawEnv.VISION_CUSTOM_BASE_URL || '',
  VISION_CUSTOM_MODEL: rawEnv.VISION_CUSTOM_MODEL || '',
};
