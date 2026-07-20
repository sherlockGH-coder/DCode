export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dcode.theme';
export const THEME_CHANGE_EVENT = 'dcode-theme-change';

export function getThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function applyThemePreference(preference: ThemePreference): void {
  const isDark = preference === 'dark'
    || (preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = preference;
}

export function setThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyThemePreference(preference);
  window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: preference }));
}

export function installThemeSync(): () => void {
  const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  const sync = () => applyThemePreference(getThemePreference());
  const handleSystemChange = () => {
    if (getThemePreference() === 'system') sync();
  };
  const handlePreferenceChange = (event: Event) => {
    applyThemePreference((event as CustomEvent<ThemePreference>).detail);
  };

  sync();
  systemTheme?.addEventListener('change', handleSystemChange);
  window.addEventListener(THEME_CHANGE_EVENT, handlePreferenceChange);

  return () => {
    systemTheme?.removeEventListener('change', handleSystemChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handlePreferenceChange);
  };
}
