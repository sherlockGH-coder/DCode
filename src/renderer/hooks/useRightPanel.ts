import { usePanel } from './usePanel';

export const WORKSPACE_PANEL_DEFAULT_WIDTH = 640;

export function useRightPanel() {
  return usePanel({
    localStorageKey: 'right-panel',
    defaultSize: WORKSPACE_PANEL_DEFAULT_WIDTH,
    minSize: 360,
    maxSize: 1200,
    direction: 'horizontal',
    defaultCollapsed: true,
    persistCollapsed: false,
    invertDelta: true,
  });
}
