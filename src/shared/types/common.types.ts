/** Scope: built-in, global user, or project. */
export type Scope = 'builtin' | 'user' | 'project';

/** Editable scope: global user or project, excluding built-in. */
export type BasicScope = 'user' | 'project';

/** Basic status: pending, in progress, or completed. */
export type BaseStatus = 'pending' | 'in_progress' | 'completed';

/** Common API-key configuration state. */
export interface WithApiKey {
  /** Whether an API key is configured; plaintext is never sent to the renderer. */
  apiKeySet: boolean;
}

/** Common error categories. */
export type ErrorKind = 'rate_limit' | 'network' | 'auth' | 'timeout' | 'unknown';
