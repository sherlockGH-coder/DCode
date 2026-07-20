import { env } from '../env';

export const DEFAULT_BASE_URL = env.ANTHROPIC_BASE_URL;

export const MAX_TOOL_RESULT_SIZE = 100 * 1024;
export const TOOL_RESULT_PREVIEW_SIZE = 4 * 1024;

export const MAX_STREAM_RETRIES = 3;
export const MAX_STREAM_RETRY_ATTEMPTS = MAX_STREAM_RETRIES + 1;
export const MAX_STREAM_RETRY_DELAY_MS = 10_000;
export const BASE_STREAM_RETRY_DELAY_MS = 1_000;
export const DEFAULT_MAX_AGENT_ROUNDS = Infinity;
