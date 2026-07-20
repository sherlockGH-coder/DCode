import React from 'react';
import type { AppSettings, AppSettingsPatch } from '../../../../shared/types/settings.types';
import { IconBolt, IconClock, IconGlobe, IconKey, IconMicrophone } from '../../icons';
import {
  PrimaryButton,
  SavePill,
  SecondaryButton,
  SectionTitle,
  SettingsGroup,
  SettingsPageHeader,
  SettingsRow,
  StatusPill,
  settingsMonoInputClass,
  settingsSelectClass,
} from '../SettingsPrimitives';
import MaskedSecretInput from '../controls/MaskedSecretInput';

interface Props {
  settings: AppSettings;
  patch: (p: AppSettingsPatch) => Promise<AppSettings | undefined>;
  setSpeechApiKey: (key: string) => Promise<void>;
}

type SaveState = 'idle' | 'saving' | 'saved';

const NumberStepper: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      className="h-8 flex-1 accent-[#3897F8]"
      type="range"
      min={5}
      max={180}
      step={5}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="最长录音时长"
    />
    <div className="relative w-[92px] shrink-0">
      <input
        className={`${settingsMonoInputClass} pr-8 text-right`}
        type="number"
        min={5}
        max={180}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-[#8E8E93]">
        秒
      </span>
    </div>
  </div>
);

const SummaryItem: React.FC<{ label: string; value: string; muted?: boolean }> = ({ label, value, muted }) => (
  <div className="min-w-0 border-t border-black/[0.055] px-4 py-3 first:border-t-0 dark:border-white/[0.07] sm:border-l sm:border-t-0 sm:first:border-l-0">
    <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#A1A1AA] dark:text-white/32">
      {label}
    </div>
    <div className={`mt-1 truncate text-[13.5px] font-semibold ${muted ? 'text-[#8E8E93] dark:text-white/42' : 'text-[#1D2127] dark:text-white'}`}>
      {value}
    </div>
  </div>
);

const SpeechSummary: React.FC<{ speech: AppSettings['speech']; clearKey: boolean }> = ({ speech, clearKey }) => {
  const ready = speech.apiKeySet && !clearKey;
  const languageLabel = speech.language.trim() || '自动检测';

  return (
    <SettingsGroup className="overflow-visible">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#3897F8]/10 text-[#147CE5] dark:bg-blue-400/[0.12] dark:text-blue-300">
            <IconMicrophone size={20} className="text-current" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[14px] font-semibold text-[#1D2127] dark:text-white">麦克风转写</p>
              <StatusPill tone={ready ? 'blue' : 'amber'} label={ready ? '已连接' : '需要密钥'} />
            </div>
            <p className="mt-1 truncate text-[12.5px] font-medium text-[#8E8E93] dark:text-white/42">
              {speech.baseUrl || '未设置 Base URL'}
            </p>
          </div>
        </div>
        <SummaryItem label="Model" value={speech.model || '未设置'} muted={!speech.model} />
        <SummaryItem label="Language" value={languageLabel} muted={!speech.language.trim()} />
      </div>
    </SettingsGroup>
  );
};

const SpeechSection: React.FC<Props> = ({ settings, patch, setSpeechApiKey }) => {
  const [keyDraft, setKeyDraft] = React.useState('');
  const [clearKey, setClearKey] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const speech = settings.speech;
  const hasPendingSecretChange = clearKey || keyDraft.trim().length > 0;
  const isKeyConfigured = speech.apiKeySet && !clearKey;

  React.useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const showSaved = () => {
    setSaveState('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
  };

  const handleSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await patch({
        speech: {
          provider: speech.provider,
          baseUrl: speech.baseUrl,
          model: speech.model,
          language: speech.language,
          maxDurationSeconds: speech.maxDurationSeconds,
        },
      });
      if (hasPendingSecretChange) {
        await setSpeechApiKey(clearKey ? '' : keyDraft);
      }
      setKeyDraft('');
      setClearKey(false);
      showSaved();
    } catch (err) {
      setError((err as Error).message || '保存失败');
      setSaveState('idle');
    }
  };

  const patchSpeech = (next: AppSettingsPatch['speech']) => {
    setError(null);
    void patch({ speech: next }).catch((err) => {
      setError((err as Error).message || '保存失败');
    });
  };

  return (
    <div className="pb-10">
      <SettingsPageHeader
        title="语音输入"
        description="配置麦克风录音的转写服务"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle
            aside={<StatusPill tone={isKeyConfigured ? 'blue' : 'neutral'} label={isKeyConfigured ? '转写可用' : '等待配置'} />}
          >
            当前状态
          </SectionTitle>
          <SpeechSummary speech={speech} clearKey={clearKey} />
        </section>

        <section>
          <SectionTitle
            aside={<StatusPill tone={isKeyConfigured ? 'blue' : 'neutral'} label={isKeyConfigured ? '密钥已配置' : '未配置密钥'} />}
          >
            服务端点
          </SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="Provider"
              description="语音转文字接口协议"
              icon={<IconMicrophone size={15} className="text-current" />}
            >
              <select
                className={settingsSelectClass}
                value={speech.provider}
                onChange={(event) => patchSpeech({ provider: event.target.value as AppSettings['speech']['provider'] })}
              >
                <option value="openai-compatible">OpenAI-compatible Transcriptions</option>
              </select>
            </SettingsRow>
            <SettingsRow
              title="Base URL"
              description="例如 OpenAI 或本地兼容服务的地址"
              icon={<IconGlobe size={15} className="text-current" />}
            >
              <input
                className={settingsMonoInputClass}
                value={speech.baseUrl}
                onChange={(event) => patchSpeech({ baseUrl: event.target.value })}
                placeholder="https://api.openai.com"
              />
            </SettingsRow>
          </SettingsGroup>
        </section>

        <section>
          <SectionTitle
            aside={hasPendingSecretChange ? <StatusPill tone="amber" label="待保存" /> : undefined}
          >
            身份认证
          </SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="API Key"
              description={
                speech.apiKeySet
                  ? '留空保持当前密钥，输入新值会替换已保存密钥'
                  : '本地 localhost 服务可留空'
              }
              icon={<IconKey size={15} className="text-current" />}
              tall
            >
              <div className="space-y-2">
                <MaskedSecretInput
                  className={settingsMonoInputClass}
                  type="password"
                  value={keyDraft}
                  configured={isKeyConfigured}
                  onValueChange={(next) => {
                    setKeyDraft(next);
                    setClearKey(false);
                  }}
                  placeholder={speech.apiKeySet ? '输入新密钥以替换' : 'sk-...'}
                  autoComplete="off"
                  spellCheck={false}
                />
                {speech.apiKeySet && (
                  <label className="flex items-center justify-end gap-2 text-[12px] font-semibold text-[#6B7280] transition-colors hover:text-[#1D2127] dark:text-white/45 dark:hover:text-white/78">
                    <input
                      type="checkbox"
                      checked={clearKey}
                      onChange={(event) => {
                        setClearKey(event.target.checked);
                        if (event.target.checked) setKeyDraft('');
                      }}
                      className="h-3.5 w-3.5 accent-[#3897F8]"
                    />
                    清除已保存的密钥
                  </label>
                )}
              </div>
            </SettingsRow>
            <SettingsRow
              title="密钥更改"
              description={hasPendingSecretChange ? '保存后才会替换或清除本地密钥' : '普通转写参数会自动保存，密钥不会回显'}
              icon={<IconKey size={15} className="text-current" />}
            >
              <div className="flex items-center justify-end gap-2">
                {hasPendingSecretChange && (
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setKeyDraft('');
                      setClearKey(false);
                    }}
                    disabled={saveState === 'saving'}
                  >
                    取消
                  </SecondaryButton>
                )}
                <PrimaryButton
                  type="button"
                  onClick={handleSave}
                  disabled={saveState === 'saving' || !hasPendingSecretChange}
                >
                  {saveState === 'saving' ? '保存中...' : '保存更改'}
                </PrimaryButton>
              </div>
            </SettingsRow>
          </SettingsGroup>
        </section>

        <section>
          <SectionTitle>转写配置</SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="Model"
              description="转写模型名称"
              icon={<IconBolt size={15} className="text-current" />}
            >
              <input
                className={settingsMonoInputClass}
                value={speech.model}
                onChange={(event) => patchSpeech({ model: event.target.value })}
                placeholder="whisper-1"
              />
            </SettingsRow>
            <SettingsRow title="Language" description="留空时由服务自动检测语言">
              <input
                className={settingsMonoInputClass}
                value={speech.language}
                onChange={(event) => patchSpeech({ language: event.target.value })}
                placeholder="auto"
              />
            </SettingsRow>
            <SettingsRow
              title="最长录音时长"
              description="限制单次语音输入的录音窗口"
              icon={<IconClock size={15} className="text-current" />}
            >
              <NumberStepper
                value={speech.maxDurationSeconds}
                onChange={(value) => patchSpeech({ maxDurationSeconds: Math.min(180, Math.max(5, Number.isFinite(value) ? value : 60)) })}
              />
            </SettingsRow>
          </SettingsGroup>
        </section>
      </div>
    </div>
  );
};

export default SpeechSection;
