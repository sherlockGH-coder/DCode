import React from 'react';

interface ActionButtonProps<A extends string> {
  action: A;
  variant: 'primary' | 'secondary' | 'danger' | 'dangerActive';
  title: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled: boolean;
  testId?: string;
  onSelect: (action: A) => void;
  onClick: () => void;
}

export function ActionButton<A extends string>({ action, variant, title, icon, selected, disabled, testId = 'approval-option', onSelect, onClick }: ActionButtonProps<A>) {
  const danger = variant === 'danger' || variant === 'dangerActive';
  const classes = selected
    ? danger
      ? 'border-diff-del/45 bg-diff-del-bg text-diff-del ring-1 ring-diff-del/35'
      : 'border-accent bg-accent text-white ring-1 ring-accent/45'
    : danger
      ? 'border-hairline bg-transparent text-diff-del hover:bg-bg-hover'
      : 'border-hairline bg-transparent text-text-primary hover:bg-bg-hover';

  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      onPointerMove={() => onSelect(action)}
      onFocus={() => onSelect(action)}
      className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] border px-3 text-left transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">{title}</span>
    </button>
  );
}

export const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
