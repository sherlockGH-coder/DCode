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
    label: '默认审批',
    desc: '本地只读工具自动执行；bash、文件写入、联网请求和外部状态变更仍会弹窗确认。',
    icon: <IconAsk />,
  },
  {
    value: 'auto_review',
    label: '文件操作自动放行',
    desc: '本地文件读取、搜索、写入和编辑会自动执行；bash、联网请求和任务变更仍需确认。',
    icon: <IconAllow />,
  },
  {
    value: 'full_access',
    label: '完全访问',
    desc: '不弹权限审批，AI 可直接执行工具和终端命令。仅在完全信任的本地开发环境使用。',
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
          启用完全访问模式？
        </h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-secondary">
          启用后，AI 可以直接执行工具和终端命令，不再显示权限审批。请仅在完全信任的本地开发环境中使用。
        </p>
        <div className="mt-[22px] flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] border border-hairline bg-bg-main px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="inline-flex h-[34px] items-center justify-center rounded-[6px] border border-red-600 bg-red-600 px-3 text-[13px] font-semibold text-white transition-colors hover:border-red-700 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSaving ? '启用中...' : '启用完全访问'}
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
      setError((err as Error).message || '保存失败');
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
        title="权限控制"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle>工具审批策略</SectionTitle>
          <SettingsGroup>
            <div role="radiogroup" aria-label="工具审批策略">
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
            <SectionTitle>风险提示</SectionTitle>
            <SettingsGroup>
              <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-text-primary">完全访问已启用</div>
                  <p className="mt-1 max-w-[640px] text-[13px] leading-[1.48] text-text-secondary">
                    当前不会显示工具权限审批。涉及删除、安装、网络或凭据相关操作时，请确认当前环境完全可信。
                  </p>
                </div>
                <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-[11.5px] font-semibold text-red-600 dark:text-red-400">
                  高风险
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
