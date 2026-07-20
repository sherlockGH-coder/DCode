import React from 'react';

export const settingsInputClass =
  'h-8 w-full rounded-[7px] border border-transparent bg-bg-chip px-3 text-[13px] font-medium text-text-primary outline-none transition-all placeholder:text-text-tertiary hover:bg-bg-hover focus:border-accent/45 focus:bg-bg-body focus:ring-4 focus:ring-accent-bg dark:focus:bg-white/[0.06]';

export const settingsMonoInputClass = `${settingsInputClass} font-mono text-[12.5px]`;

export const settingsSelectClass =
  settingsInputClass +
  ' cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M3%204.5l3%203%203-3%22%20stroke%3D%22%237c7e86%22%20stroke-width%3D%221.7%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-9';

export const settingsGroupClass =
  'overflow-hidden rounded-[8px] border border-hairline bg-bg-body shadow-[var(--shadow-card)]';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'neutral';

const toneClass: Record<Tone, { text: string; bg: string; dot: string }> = {
  blue: { text: 'text-accent', bg: 'bg-accent-bg', dot: 'bg-accent' },
  green: { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  amber: { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  red: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  neutral: { text: 'text-text-tertiary', bg: 'bg-black/[0.045] dark:bg-white/[0.06]', dot: 'bg-[#B8B8BE]' },
};

export const SettingsPageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <header className="relative mb-8 flex min-h-[74px] flex-col justify-center gap-3">
    <div>
      <h2 className="text-[22px] font-semibold leading-8 text-text-primary">{title}</h2>
      {description && (
        <p className="mt-1.5 text-[13px] font-medium text-text-tertiary">{description}</p>
      )}
    </div>
    {action && <div className="sm:absolute sm:right-0 sm:top-1">{action}</div>}
  </header>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({
  children,
  aside,
}) => (
  <div className="mb-3 flex items-center justify-between px-0.5">
    <h3 className="text-[15px] font-semibold text-text-primary">{children}</h3>
    {aside}
  </div>
);

export const SettingsGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`${settingsGroupClass} ${className}`.trim()}>{children}</div>
);

export const SettingsRow: React.FC<{
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  tall?: boolean;
}> = ({ title, description, icon, children, tall }) => (
  <div
    className={`grid grid-cols-1 gap-3 border-t border-black/[0.055] px-4 py-3.5 first:border-t-0 dark:border-white/[0.07] sm:grid-cols-[minmax(0,1fr)_minmax(260px,330px)] sm:items-center sm:gap-6 ${
      tall ? 'min-h-[82px]' : 'min-h-[64px]'
    }`}
  >
    <div className="flex min-w-0 items-start gap-3">
      {icon && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-bg-chip text-text-secondary">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold leading-5 text-text-primary">{title}</div>
        {description && (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">
            {description}
          </p>
        )}
      </div>
    </div>
    {children && <div className="min-w-0 justify-self-stretch">{children}</div>}
  </div>
);

export const StatusPill: React.FC<{ tone?: Tone; label: string }> = ({ tone = 'neutral', label }) => {
  const colors = toneClass[tone];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
};

export const SavePill: React.FC<{ state: 'idle' | 'saving' | 'saved'; error?: string | null }> = ({
  state,
  error,
}) => {
  if (error) return <StatusPill tone="red" label={error} />;
  if (state === 'saving') return <StatusPill tone="neutral" label="保存中..." />;
  if (state === 'saved') return <StatusPill tone="green" label="已保存" />;
  return null;
};

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <button
    {...props}
    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[7px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(77,107,254,0.22)] transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bg-chip disabled:text-text-tertiary disabled:shadow-none ${className}`.trim()}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <button
    {...props}
    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[7px] border border-hairline bg-bg-body px-3 text-[13px] font-semibold text-text-secondary transition-all hover:border-border-strong hover:bg-bg-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${className}`.trim()}
  >
    {children}
  </button>
);

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <label className="relative inline-flex items-center">
    <span className="sr-only">{label}</span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="sr-only peer"
    />
    <div className="h-[22px] w-[40px] rounded-full bg-black/[0.12] shadow-inner transition-colors peer-checked:bg-accent peer-disabled:opacity-45 after:absolute after:left-[2px] after:top-[2px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-[18px] dark:bg-white/[0.16]" />
  </label>
);
