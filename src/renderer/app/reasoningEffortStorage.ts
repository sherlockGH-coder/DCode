export function loadStoredReasoningEffort(): string | undefined {
  try {
    const stored = localStorage.getItem('reasoning-effort');
    return stored === 'high' || stored === 'max' ? stored : undefined;
  } catch {
    return undefined;
  }
}
export function persistReasoningEffort(effort: string | undefined): void {
  try {
    if (effort === 'high' || effort === 'max') {
      localStorage.setItem('reasoning-effort', effort);
      return;
    }
    localStorage.removeItem('reasoning-effort');
  } catch {

  }
}
