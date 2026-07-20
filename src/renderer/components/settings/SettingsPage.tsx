import React, { useState } from 'react';
import SettingsNav, { type SettingsSection } from './SettingsNav';
import ModelsSection from './sections/ModelsSection';
import SpeechSection from './sections/SpeechSection';
import SearchSection from './sections/SearchSection';
import PermissionsSection from './sections/PermissionsSection';
import AppearanceSection from './sections/AppearanceSection';
import SkillsPage from '../skills/SkillsPage';
import PluginsPage from '../plugins/PluginsPage';
import { useSettings } from '../../hooks/useSettings';

interface SettingsPageProps {
  activeProject: string | null;
  onClose?: () => void;
  isMacOS?: boolean;
  isFullscreen?: boolean;
  onJumpConversation?: (conversationId: string) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  activeProject,
  onClose,
  isMacOS = false,
  isFullscreen = false,
  onJumpConversation,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { settings, isLoading, patch, setApiProfileApiKey, setTavilyApiKey, setSpeechApiKey } = useSettings();

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F7F8FA] dark:bg-zinc-950">
        <p className="text-[13px] text-text-tertiary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-row min-h-0 bg-[#F7F8FA] dark:bg-zinc-950 select-none" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif', letterSpacing: '0', WebkitFontSmoothing: 'antialiased' }}>
      <SettingsNav
        active={activeSection}
        onSelect={setActiveSection}
        onClose={onClose}
        isMacOS={isMacOS}
        isFullscreen={isFullscreen}
      />
      <main className="custom-scrollbar flex-1 overflow-y-auto min-h-0 bg-[#F7F8FA] dark:bg-zinc-950">
        {activeSection === 'skills' ? (
          <div className="h-full">
            <SkillsPage activeProject={activeProject} />
          </div>
        ) : activeSection === 'mcp' ? (
          <div className="h-full">
            <PluginsPage activeProject={activeProject} />
          </div>
        ) : (
          <div
            className={
              activeSection === 'appearance' || activeSection === 'models' || activeSection === 'speech' || activeSection === 'search' || activeSection === 'permissions'
                ? 'mx-auto w-full max-w-[860px] px-6 pt-9 pb-12 sm:px-10'
                : 'mx-auto w-full max-w-[700px] px-10 pt-8 pb-10'
            }
          >
            {activeSection === 'appearance' && <AppearanceSection />}
            {activeSection === 'models' && (
              <ModelsSection settings={settings} patch={patch} setApiProfileApiKey={setApiProfileApiKey} />
            )}
            {activeSection === 'speech' && (
              <SpeechSection settings={settings} patch={patch} setSpeechApiKey={setSpeechApiKey} />
            )}
            {activeSection === 'search' && (
              <SearchSection tavilyApiKeySet={settings.search.tavilyApiKeySet} setTavilyApiKey={setTavilyApiKey} />
            )}
            {activeSection === 'permissions' && (
              <PermissionsSection settings={settings} patch={patch} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsPage;
