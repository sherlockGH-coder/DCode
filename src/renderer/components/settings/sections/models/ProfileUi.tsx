import React from 'react';
import { IconCheck, IconInfo, IconKey } from '../../../icons';
import type { ApiProfile } from '../../../../../shared/types';
import { type SaveState } from './profileDraft';

export const PANEL_CLASS = 'rounded-lg border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:border-white/[0.08] dark:bg-[#1E1E20]';

export const SaveIndicator: React.FC<{ state: SaveState; error: string | null }> = ({ state, error }) => (
  <div className="min-h-5 text-right text-[11.5px] font-medium">
    {error && <span className="text-red-500">{error}</span>}
    {!error && state === 'saving' && <span className="text-text-tertiary">保存中...</span>}
    {!error && state === 'saved' && (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
        <IconCheck size={12} className="text-current" />已保存
      </span>
    )}
  </div>
);

export const KeyBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium ${
      active
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    }`}
  >
    <IconKey size={9} className="shrink-0" />
    {active ? 'Key' : '无 Key'}
  </span>
);

export const ProtocolBadge: React.FC<{ protocol: ApiProfile['protocol'] }> = ({ protocol }) => (
  <span
    className={`inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium ${
      protocol === 'legacy-openai'
        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
    }`}
  >
    {protocol === 'legacy-openai' && <IconInfo size={9} className="shrink-0" />}
    {protocol === 'legacy-openai' ? '需迁移' : 'Anthropic'}
  </span>
);

export const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, danger, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-all duration-150 ${
      danger
        ? 'hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10'
        : 'hover:bg-black/[0.05] hover:text-text-primary dark:hover:bg-white/[0.07]'
    } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-tertiary`}
  >
    {children}
  </button>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <section>
    <label className="mb-1.5 block text-[12.5px] font-medium text-text-primary">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-text-tertiary">{hint}</p>}
  </section>
);
