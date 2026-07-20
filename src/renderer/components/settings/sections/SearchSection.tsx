import React from 'react';
import { IconExternalOpen, IconGlobe, IconKey, IconSearch } from '../../icons';
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
} from '../SettingsPrimitives';
import MaskedSecretInput from '../controls/MaskedSecretInput';

interface Props {
  tavilyApiKeySet: boolean;
  setTavilyApiKey: (key: string) => Promise<void>;
}

const SearchSection: React.FC<Props> = ({ tavilyApiKeySet, setTavilyApiKey }) => {
  const [draftKey, setDraftKey] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDraftKey = draftKey.trim().length > 0;

  const showSaved = () => {
    setSaveState('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
  };

  const handleSave = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await setTavilyApiKey(draftKey);
      setDraftKey('');
      setShowKey(false);
      showSaved();
    } catch (err) {
      setError((err as Error).message || '保存失败');
      setSaveState('idle');
    }
  };

  const handleClear = async () => {
    setSaveState('saving');
    setError(null);
    try {
      await setTavilyApiKey('');
      setDraftKey('');
      setShowKey(false);
      showSaved();
    } catch (err) {
      setError((err as Error).message || '清除失败');
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
        title="网络搜索"
        description="为对话启用联网搜索与网页读取能力"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle
            aside={<StatusPill tone={tavilyApiKeySet ? 'blue' : 'neutral'} label={tavilyApiKeySet ? '搜索已就绪' : '未配置密钥'} />}
          >
            连接状态
          </SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title={tavilyApiKeySet ? '联网搜索已启用' : '联网搜索未启用'}
              description={tavilyApiKeySet ? 'AI 可以在对话中实时搜索网络并读取网页内容。' : '配置 Tavily API Key 后即可启用 web_search 工具。'}
              icon={<IconGlobe size={15} className="text-current" />}
            >
              <StatusPill tone={tavilyApiKeySet ? 'blue' : 'amber'} label={tavilyApiKeySet ? '可用' : '需要密钥'} />
            </SettingsRow>
          </SettingsGroup>
        </section>

        <section>
          <SectionTitle>密钥配置</SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="Tavily API Key"
              description="web_search 必需；web_fetch 配置后优先使用 Tavily，已保存的密钥不会回显"
              icon={<IconKey size={15} className="text-current" />}
              tall
            >
              <div className="space-y-2">
                <div className="flex gap-2">
                  <MaskedSecretInput
                    type={showKey ? 'text' : 'password'}
                    value={draftKey}
                    configured={tavilyApiKeySet}
                    onValueChange={setDraftKey}
                    placeholder={tavilyApiKeySet ? '输入新密钥以替换' : 'tvly-...'}
                    autoComplete="off"
                    spellCheck={false}
                    className={settingsMonoInputClass}
                  />
                  <SecondaryButton type="button" onClick={() => setShowKey((value) => !value)} className="shrink-0">
                    {showKey ? '隐藏' : '显示'}
                  </SecondaryButton>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {tavilyApiKeySet && (
                    <SecondaryButton type="button" onClick={handleClear} disabled={saveState === 'saving'}>
                      清除
                    </SecondaryButton>
                  )}
                  <PrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={!hasDraftKey || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? '保存中...' : '保存更改'}
                  </PrimaryButton>
                </div>
              </div>
            </SettingsRow>
            <SettingsRow title="获取密钥" description="打开 Tavily 控制台创建或管理搜索 API Key">
              <a
                href="https://tavily.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-end gap-1.5 text-[13px] font-semibold text-[#147CE5] transition-colors hover:text-[#0A66C2]"
              >
                Tavily 控制台
                <IconExternalOpen size={12} className="text-current" />
              </a>
            </SettingsRow>
          </SettingsGroup>
        </section>

        <section>
          <SectionTitle>可用工具</SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="web_search"
              description="联网搜索并返回相关网页的标题、链接与内容摘要"
              icon={<IconSearch size={15} className="text-current" />}
            >
              <StatusPill tone={tavilyApiKeySet ? 'green' : 'amber'} label={tavilyApiKeySet ? '已启用' : '需要密钥'} />
            </SettingsRow>
            <SettingsRow
              title="web_fetch"
              description="读取指定网页并按提示返回 Markdown 内容，优先使用 Tavily"
              icon={<IconGlobe size={15} className="text-current" />}
            >
              <StatusPill tone="green" label="开箱可用" />
            </SettingsRow>
          </SettingsGroup>
        </section>
      </div>
    </div>
  );
};

export default SearchSection;
