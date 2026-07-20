import React from 'react';
import { IconAllow, IconAsk, IconShield, IconUnlock } from '../../icons';
import type { AppSettings, AppSettingsPatch, BashExecPolicy } from '../../../../shared/types';
import {
  SavePill,
  SectionTitle,
  SettingsGroup,
  SettingsPageHeader,
  SettingsRow,
  StatusPill,
} from '../SettingsPrimitives';

interface Props {
  settings: AppSettings;
  patch: (p: AppSettingsPatch) => Promise<AppSettings | undefined>;
}

const BASH_OPTIONS: {
  value: BashExecPolicy;
  label: string;
  shortLabel: string;
  desc: string;
  icon: React.ReactNode;
  tone: 'blue' | 'amber' | 'red';
}[] = [
  {
    value: 'default',
    label: '默认审批',
    shortLabel: '默认',
    desc: '本地只读工具自动执行；bash、文件写入、联网请求和外部状态变更仍会弹窗确认。',
    icon: <IconAsk />,
    tone: 'blue',
  },
  {
    value: 'auto_review',
    label: '文件操作自动放行',
    shortLabel: '文件',
    desc: '本地文件读取、搜索、写入和编辑会自动执行；bash、联网请求和任务变更仍需确认。',
    icon: <IconAllow />,
    tone: 'amber',
  },
  {
    value: 'full_access',
    label: '完全访问',
    shortLabel: '完全',
    desc: '不弹权限审批，AI 可直接执行工具和终端命令。仅在完全信任的本地开发环境使用。',
    icon: <IconUnlock />,
    tone: 'red',
  },
];

function permissionModeCopy(mode: BashExecPolicy): string {
  if (mode === 'full_access') return '所有工具权限审批都会跳过。';
  if (mode === 'auto_review') return '文件读写编辑自动执行，bash 仍需确认。';
  return '只读工具自动执行，其他操作需要确认。';
}

const PermissionsSection: React.FC<Props> = ({ settings, patch }) => {
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOption = BASH_OPTIONS.find((option) => option.value === settings.permissions.bashExec) ?? BASH_OPTIONS[0];

  const showSaved = () => {
    setSaveState('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1800);
  };

  const handlePatch = async (p: AppSettingsPatch) => {
    setSaveState('saving');
    setError(null);
    try {
      await patch(p);
      showSaved();
    } catch (err) {
      setError((err as Error).message || '保存失败');
      setSaveState('idle');
    }
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
        description="设置 AI 执行工具和终端命令时的审批边界"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle
            aside={<StatusPill tone={activeOption.tone} label={activeOption.label} />}
          >
            工具审批策略
          </SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="当前策略"
              description={permissionModeCopy(settings.permissions.bashExec)}
              icon={<IconShield size={15} className="text-current" />}
            >
              <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-[#F1F1F3] p-1 dark:bg-white/[0.07]">
                {BASH_OPTIONS.map((option) => {
                  const selected = settings.permissions.bashExec === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handlePatch({ permissions: { bashExec: option.value } })}
                      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[7px] text-[12.5px] font-semibold transition-all ${
                        selected
                          ? 'bg-white text-[#1D2127] shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#2A2A2D] dark:text-white'
                          : 'text-[#6B7280] hover:bg-white/55 hover:text-[#1D2127] dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/75'
                      }`}
                    >
                      <span className={selected ? 'text-[#147CE5]' : 'text-current'}>{option.icon}</span>
                      {option.shortLabel}
                    </button>
                  );
                })}
              </div>
            </SettingsRow>
            <SettingsRow
              title={activeOption.label}
              description={activeOption.desc}
              icon={<span className="text-current">{activeOption.icon}</span>}
            >
              <StatusPill tone={activeOption.tone} label={activeOption.value} />
            </SettingsRow>
          </SettingsGroup>
        </section>

        {settings.permissions.bashExec === 'full_access' && (
          <section>
            <SectionTitle>风险提示</SectionTitle>
            <SettingsGroup>
              <SettingsRow
                title="完全访问已启用"
                description="当前不会显示工具权限审批。涉及删除、安装、网络或凭据相关操作时，风险由当前会话承担。"
                icon={<IconUnlock size={15} className="text-current" />}
              >
                <StatusPill tone="red" label="高风险" />
              </SettingsRow>
            </SettingsGroup>
          </section>
        )}
      </div>
    </div>
  );
};

export default PermissionsSection;
