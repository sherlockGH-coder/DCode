import React from 'react';
import { IconKey, IconPlus } from '../../icons';
import type { ApiProfile, ApiProfilePatch, AppSettings, AppSettingsPatch } from '../../../../shared/types';
import {
  PrimaryButton,
  SavePill,
  SectionTitle,
  SettingsGroup,
  SettingsPageHeader,
} from '../SettingsPrimitives';
import { ProfileCard, ProfileSummaryPanel } from './models/ProfileCard';
import { ProfileEditor } from './models/ProfileEditor';
import {
  apiProfilePatch,
  emptyDraft,
  toDraft,
  type DraftProfile,
  type SaveState,
} from './models/profileDraft';

interface Props {
  settings: AppSettings;
  patch: (p: AppSettingsPatch) => Promise<AppSettings | undefined>;
  setApiProfileApiKey: (profileId: string, key: string) => Promise<void>;
}

const ModelsSection: React.FC<Props> = ({ settings, patch, setApiProfileApiKey }) => {
  const [editing, setEditing] = React.useState<DraftProfile | null>(null);
  const [keyDraft, setKeyDraft] = React.useState('');
  const [clearKey, setClearKey] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeProfile = React.useMemo(
    () => settings.apiProfiles.find((profile) => profile.id === settings.activeApiProfileId),
    [settings.activeApiProfileId, settings.apiProfiles],
  );

  const showSaved = () => {
    setSaveState('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1800);
  };

  React.useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const openEditor = (profile?: ApiProfile) => {
    setError(null);
    setKeyDraft('');
    setClearKey(false);
    setSaveState('idle');
    setEditing(profile ? toDraft(profile) : emptyDraft());
  };

  const closeEditor = () => {
    setEditing(null);
    setError(null);
    setKeyDraft('');
    setClearKey(false);
  };

  const saveProfiles = async (profiles: ApiProfilePatch[], activeId = settings.activeApiProfileId) => {
    const updated = await patch({ apiProfiles: profiles, activeApiProfileId: activeId });
    window.dispatchEvent(new Event('models:refresh'));
    return updated;
  };

  const handleActivate = async (id: string) => {
    setSaveState('saving');
    setError(null);
    try {
      await patch({ activeApiProfileId: id });
      window.dispatchEvent(new Event('models:refresh'));
      showSaved();
    } catch (err) {
      setError((err as Error).message || '切换失败');
      setSaveState('idle');
    }
  };

  const handleDelete = async (id: string) => {
    if (settings.apiProfiles.length <= 1) return;
    const target = settings.apiProfiles.find((profile) => profile.id === id);
    if (!target || !window.confirm(`删除配置"${target.name}"？`)) return;
    setSaveState('saving');
    setError(null);
    try {
      const nextProfiles = settings.apiProfiles
        .filter((profile) => profile.id !== id)
        .map(apiProfilePatch);
      const nextActiveId = id === settings.activeApiProfileId ? nextProfiles[0].id : settings.activeApiProfileId;
      await saveProfiles(nextProfiles, nextActiveId);
      showSaved();
    } catch (err) {
      setError((err as Error).message || '删除失败');
      setSaveState('idle');
    }
  };

  const handleDuplicate = (profile: ApiProfile) => {
    const draft = toDraft(profile);
    setEditing({
      ...draft,
      id: crypto.randomUUID?.() ?? `profile-${Date.now()}`,
      name: `${draft.name} 副本`,
      apiKeySet: false,
    });
    setKeyDraft('');
    setClearKey(false);
    setError(null);
    setSaveState('idle');
  };

  const handleSaveEditing = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError('请填写配置名称');
      return;
    }
    if (!editing.baseUrl.trim()) {
      setError('请填写 Base URL');
      return;
    }

    setSaveState('saving');
    setError(null);
    try {
      const existingIds = new Set(settings.apiProfiles.map((profile) => profile.id));
      const nextProfile = apiProfilePatch(editing);
      const nextProfiles = existingIds.has(editing.id)
        ? settings.apiProfiles.map((profile) => profile.id === editing.id ? nextProfile : apiProfilePatch(profile))
        : [...settings.apiProfiles.map(apiProfilePatch), nextProfile];
      await saveProfiles(nextProfiles);
      if (clearKey || keyDraft.trim()) {
        await setApiProfileApiKey(editing.id, clearKey ? '' : keyDraft);
      }
      window.dispatchEvent(new Event('models:refresh'));
      showSaved();
      setEditing(null);
      setKeyDraft('');
      setClearKey(false);
    } catch (err) {
      setError((err as Error).message || '保存失败');
      setSaveState('idle');
    }
  };

  if (editing) {
    return (
      <ProfileEditor
        editing={editing}
        keyDraft={keyDraft}
        clearKey={clearKey}
        saveState={saveState}
        error={error}
        onClose={closeEditor}
        onSave={handleSaveEditing}
        onEditingChange={setEditing}
        onKeyDraftChange={setKeyDraft}
        onClearKeyChange={setClearKey}
      />
    );
  }

  return (
    <div className="pb-10">
      <SettingsPageHeader
        title="配置"
        description="管理 Anthropic-compatible 端点、默认模型与 API 密钥"
        action={
          <div className="flex items-center gap-2">
            <SavePill state={saveState} error={error} />
            <PrimaryButton
              type="button"
              onClick={() => openEditor()}
            >
              <IconPlus size={14} className="text-white" />
              添加配置
            </PrimaryButton>
          </div>
        }
      />

      {settings.apiProfiles.length === 0 ? (
        <EmptyState onCreate={() => openEditor()} />
      ) : (
        <div className="space-y-9">
          <section>
            <SectionTitle>当前配置</SectionTitle>
            <ProfileSummaryPanel
              profile={activeProfile}
              profileCount={settings.apiProfiles.length}
              onEditActive={() => activeProfile && openEditor(activeProfile)}
            />
          </section>

          <section>
            <SectionTitle
              aside={<span className="text-[12px] font-semibold text-[#8E8E93] dark:text-white/42">{settings.apiProfiles.length} 项</span>}
            >
              API 配置
            </SectionTitle>
            <SettingsGroup>
              {settings.apiProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  active={profile.id === settings.activeApiProfileId}
                  canDelete={settings.apiProfiles.length > 1}
                  onActivate={() => handleActivate(profile.id)}
                  onEdit={() => openEditor(profile)}
                  onDuplicate={() => handleDuplicate(profile)}
                  onDelete={() => handleDelete(profile.id)}
                />
              ))}
            </SettingsGroup>
          </section>
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <SettingsGroup className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#F1F1F3] text-[#6B7280] dark:bg-white/[0.08] dark:text-white/55">
      <IconKey size={24} className="text-current" />
    </div>
    <p className="text-[14px] font-semibold text-[#1D2127] dark:text-white">尚未添加任何配置</p>
    <p className="mt-1 text-[12.5px] text-[#8E8E93] dark:text-white/42">创建第一个 Anthropic-compatible 配置后即可开始对话。</p>
    <PrimaryButton
      type="button"
      onClick={onCreate}
      className="mt-5"
    >
      <IconPlus size={14} className="text-white" />
      添加配置
    </PrimaryButton>
  </SettingsGroup>
);

export default ModelsSection;
