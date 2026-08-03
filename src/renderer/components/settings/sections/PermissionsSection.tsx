import React from 'react';
import { IconAllow, IconAsk, IconUnlock } from '../../icons';
import type { AppSettings, AppSettingsPatch, BashExecPolicy } from '../../../../shared/types';
import {
  SavePill,
  SectionTitle,
  SettingsGroup,
  SettingsPageHeader,
} from '../SettingsPrimitives';

interface Props {
  settings: AppSettings;
  patch: (p: AppSettingsPatch) => Promise<AppSettings | undefined>;
}

const BASH_OPTIONS: {
  value: BashExecPolicy;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'default',
    label: 'Default approval',
    desc: 'Local read-only tools run automatically; bash, file writes, network requests, and external state changes still require confirmation.',
    icon: <IconAsk />,
  },
  {
    value: 'auto_review',
    label: 'Auto-allow file operations',
    desc: 'Local file reads, searches, writes, and edits run automatically; bash, network requests, and task changes still require confirmation.',
    icon: <IconAllow />,
  },
  {
    value: 'full_access',
    label: 'Full access',
    desc: 'Skip permission prompts; AI can run tools and terminal commands directly. Use only in a fully trusted local development environment.',
    icon: <IconUnlock />,
  },
];

const FullAccessConfirmDialog: React.FC<{
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ isSaving, onCancel, onConfirm }) => {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-full-access-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/35 px-6 backdrop-blur-[2px] animate-[content-fade-in_150ms_ease-out]"
      onClick={() => {
        if (!isSaving) onCancel();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-xl border border-hairline bg-bg-body p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-full-access-title" className="text-[17px] font-bold text-text-primary">
          Enable full access mode?
        </h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-secondary">
          Once enabled, AI can run tools and terminal commands directly without permission prompts. Use this only in a fully trusted local development environment.
        </p>
        <div className="mt-[22px] flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] border border-hairline bg-bg-main px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] border border-red-600 bg-red-600 px-3 text-[13px] font-semibold text-white transition-colors hover:border-red-700 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSaving ? 'Enabling...' : 'Enable full access'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PermissionsSection: React.FC<Props> = ({ settings, patch }) => {
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [showFullAccessConfirm, setShowFullAccessConfirm] = React.useState(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaved = () => {
    setSaveState('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1800);
  };

  const handlePatch = async (mode: BashExecPolicy): Promise<boolean> => {
    setSaveState('saving');
    setError(null);
    try {
      await patch({ permissions: { bashExec: mode } });
      showSaved();
      return true;
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
      setSaveState('idle');
      return false;
    }
  };

  const selectMode = (mode: BashExecPolicy) => {
    if (mode === settings.permissions.bashExec || saveState === 'saving') return;
    if (mode === 'full_access') {
      setShowFullAccessConfirm(true);
      return;
    }
    void handlePatch(mode);
  };

  const confirmFullAccess = async () => {
    const saved = await handlePatch('full_access');
    if (saved) setShowFullAccessConfirm(false);
  };

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="pb-10">
      <SettingsPageHeader
        title="Permissions"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle>Tool approval policy</SectionTitle>
          <SettingsGroup>
            <div role="radiogroup" aria-label="Tool approval policy">
              {BASH_OPTIONS.map((option) => {
                const selected = settings.permissions.bashExec === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectMode(option.value)}
                    className="grid min-h-[76px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-7 border-t border-black/[0.055] bg-transparent px-5 py-4 text-left transition-colors first:border-t-0 hover:bg-black/[0.018] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/35 dark:border-white/[0.07] dark:hover:bg-white/[0.025]"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[14px] font-semibold text-text-primary">
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-text-secondary [&>svg]:h-[17px] [&>svg]:w-[17px]">
                          {option.icon}
                        </span>
                        {option.label}
                      </span>
                      <span className="mt-1 block max-w-[640px] text-[13px] leading-[1.48] text-text-secondary">
                        {option.desc}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
                        selected
                          ? 'border-accent bg-accent'
                          : 'border-black/30 bg-bg-main dark:border-white/35'
                      }`}
                    >
                      {selected && <span className="h-[9px] w-[9px] rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsGroup>
        </section>

        {settings.permissions.bashExec === 'full_access' && (
          <section>
            <SectionTitle>Risk notice</SectionTitle>
            <SettingsGroup>
              <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-text-primary">Full access is enabled</div>
                  <p className="mt-1 max-w-[640px] text-[13px] leading-[1.48] text-text-secondary">
                    Tool permission prompts are currently disabled. Confirm that this environment is fully trusted before deletion, installation, network, or credential-related operations.
                  </p>
                </div>
                <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-[11.5px] font-semibold text-red-600 dark:text-red-400">
                  High risk
                </span>
              </div>
            </SettingsGroup>
          </section>
        )}
      </div>

      {showFullAccessConfirm && (
        <FullAccessConfirmDialog
          isSaving={saveState === 'saving'}
          onCancel={() => setShowFullAccessConfirm(false)}
          onConfirm={() => { void confirmFullAccess(); }}
        />
      )}
    </div>
  );
};

export default PermissionsSection;
