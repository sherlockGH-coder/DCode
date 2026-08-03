import React from 'react';
import { IconExternalOpen, IconGlobe, IconKey } from '../../icons';
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
      setError((err as Error).message || 'Failed to save');
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
      setError((err as Error).message || 'Failed to clear');
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
        title="Web search"
        action={<SavePill state={saveState} error={error} />}
      />

      <div className="space-y-9">
        <section>
          <SectionTitle>Connection status</SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title={tavilyApiKeySet ? 'Web search is enabled' : 'Web search is not enabled'}
              description={tavilyApiKeySet ? 'AI can search the web and read pages in real time during conversations.' : 'Configure a Tavily API key to enable the web_search tool.'}
              icon={<IconGlobe size={15} className="text-current" />}
            >
              <div className="flex justify-end">
                <StatusPill tone={tavilyApiKeySet ? 'blue' : 'amber'} label={tavilyApiKeySet ? 'Available' : 'Key required'} />
              </div>
            </SettingsRow>
          </SettingsGroup>
        </section>

        <section>
          <SectionTitle>Key configuration</SectionTitle>
          <SettingsGroup>
            <SettingsRow
              title="Tavily API Key"
              description="Required for web_search; web_fetch prefers Tavily when configured. Saved keys are never shown."
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
                    placeholder={tavilyApiKeySet ? 'Enter a new key to replace it' : 'tvly-...'}
                    autoComplete="off"
                    spellCheck={false}
                    className={settingsMonoInputClass}
                  />
                  <SecondaryButton type="button" onClick={() => setShowKey((value) => !value)} className="shrink-0">
                    {showKey ? 'Hide' : 'Show'}
                  </SecondaryButton>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {tavilyApiKeySet && (
                    <SecondaryButton type="button" onClick={handleClear} disabled={saveState === 'saving'}>
                      Clear
                    </SecondaryButton>
                  )}
                  <PrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={!hasDraftKey || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? 'Saving...' : 'Save changes'}
                  </PrimaryButton>
                </div>
              </div>
            </SettingsRow>
            <SettingsRow title="Get a key" description="Open the Tavily console to create or manage a search API key">
              <div className="flex justify-end">
                <a
                  href="https://tavily.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-end gap-1.5 text-[13px] font-semibold text-[#147CE5] transition-colors hover:text-[#0A66C2]"
                >
                  Tavily console
                  <IconExternalOpen size={12} className="text-current" />
                </a>
              </div>
            </SettingsRow>
          </SettingsGroup>
        </section>
      </div>
    </div>
  );
};

export default SearchSection;
