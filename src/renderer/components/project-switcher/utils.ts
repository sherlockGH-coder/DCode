export const COLLAPSED_CONVERSATION_LIMIT = 6;
export const UNSORTED_CONVERSATION_LIST_ID = 'unsorted';

const MENU_WIDTH = 140;
const MENU_FALLBACK_HEIGHT = 76;
const MENU_GAP = 6;
const MENU_VIEWPORT_PADDING = 8;

export interface MenuPosition {
  left: number;
  top: number;
}

const clamp = (value: number, min: number, max: number): number => (
  Math.min(Math.max(value, min), max)
);

export const getMenuPosition = (
  trigger: HTMLElement,
  menu: HTMLElement | null = null,
): MenuPosition => {
  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = menu?.offsetWidth || MENU_WIDTH;
  const menuHeight = menu?.offsetHeight || MENU_FALLBACK_HEIGHT;
  const maxLeft = Math.max(
    MENU_VIEWPORT_PADDING,
    window.innerWidth - menuWidth - MENU_VIEWPORT_PADDING,
  );
  const maxTop = Math.max(
    MENU_VIEWPORT_PADDING,
    window.innerHeight - menuHeight - MENU_VIEWPORT_PADDING,
  );
  const belowTop = triggerRect.bottom + MENU_GAP;
  const aboveTop = triggerRect.top - menuHeight - MENU_GAP;
  const hasSpaceBelow = belowTop + menuHeight <= window.innerHeight - MENU_VIEWPORT_PADDING;
  const rawTop = hasSpaceBelow ? belowTop : aboveTop;

  return {
    left: clamp(triggerRect.right - menuWidth, MENU_VIEWPORT_PADDING, maxLeft),
    top: clamp(rawTop, MENU_VIEWPORT_PADDING, maxTop),
  };
};

export const formatRelativeTime = (updatedAtStr: string | undefined): string => {
  if (!updatedAtStr) return '';
  try {
    const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(updatedAtStr)
      ? updatedAtStr
      : updatedAtStr.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'now';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo`;

    return `${Math.floor(diffMonths / 12)}y`;
  } catch {
    return '';
  }
};
