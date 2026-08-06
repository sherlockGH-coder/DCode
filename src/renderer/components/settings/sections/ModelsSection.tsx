import React from 'react';
import {
  IconCheck,
  IconChevronDown,
  IconCube,
  IconDeepSeek,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
  IconTestConnection,
  IconTrash,
  IconX,
} from '../../icons';
import type { ApiProfile, ApiProfilePatch, AppSettings, AppSettingsPatch } from '../../../../shared/types';
import { SavePill } from '../SettingsPrimitives';
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
  getApiProfileApiKey?: (profileId: string) => Promise<string>;
}

const DEFAULT_DEEPSEEK_ID = 'default-anthropic';

const PROTOCOL_OPTIONS: { value: ApiProfile['protocol']; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic Messages (/v1/messages)' },
  { value: 'legacy-openai', label: 'Chat Completions (/chat/completions)' },
  { value: 'responses', label: 'Responses (/responses)' },
];

const CustomFormatSelect: React.FC<{
  value: ApiProfile['protocol'];
  onChange: (val: ApiProfile['protocol']) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = PROTOCOL_OPTIONS.find((opt) => opt.value === value) || PROTOCOL_OPTIONS[0];

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm text-gray-900 dark:text-white flex items-center justify-between shadow-2xs hover:border-gray-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer select-none"
      >
        <span className="truncate font-medium">{selectedOption.label}</span>
        <IconChevronDown
          size={16}
          className={`text-gray-400 dark:text-zinc-500 transition-transform duration-200 ${
            open ? 'rotate-180 text-gray-700 dark:text-white' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-gray-200/90 dark:border-zinc-700 bg-white/95 dark:bg-[#1E1E22]/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95">
          {PROTOCOL_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#4D6BFE]/10 text-[#4D6BFE] dark:bg-[#4D6BFE]/20 font-semibold'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/80'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <IconCheck size={14} className="text-[#4D6BFE] shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function formatContextWindow(val: string): string {
  const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return val || '128K';
  if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return `${num}`;
}

interface EditModelModalProps {
  modelId: string;
  contextWindow: string;
  onClose: () => void;
  onSave: (newModelId: string, newContextWindow: string) => void;
}

const EditModelModal: React.FC<EditModelModalProps> = ({
  modelId,
  contextWindow,
  onClose,
  onSave,
}) => {
  const [draftId, setDraftId] = React.useState(modelId);
  const [draftContext, setDraftContext] = React.useState(contextWindow || '128000');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
      <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xl p-6 relative space-y-5 animate-in zoom-in-95 select-none">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            编辑模型配置
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
              模型 ID
            </label>
            <input
              type="text"
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
              上下文窗口
            </label>
            <input
              type="text"
              value={draftContext}
              onChange={(e) => setDraftContext(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-zinc-700/80 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (draftId.trim()) {
                onSave(draftId.trim(), draftContext.trim());
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-all cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditProviderNameModalProps {
  initialName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

const EditProviderNameModal: React.FC<EditProviderNameModalProps> = ({
  initialName,
  onClose,
  onSave,
}) => {
  const [name, setName] = React.useState(initialName);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
      <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-2xl p-6 relative space-y-5 animate-in zoom-in-95 select-none">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            修改供应商名称
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
            供应商名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onSave(name.trim());
              }
              if (e.key === 'Escape') onClose();
            }}
            autoFocus
            className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-zinc-700/80 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onSave(name.trim());
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-all cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const ModelsSection: React.FC<Props> = ({
  settings,
  patch,
  setApiProfileApiKey,
  getApiProfileApiKey,
}) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => settings.activeApiProfileId || settings.apiProfiles[0]?.id || null,
  );
  const [editing, setEditing] = React.useState<DraftProfile>(() => {
    const target = settings.apiProfiles.find((p) => p.id === (settings.activeApiProfileId || settings.apiProfiles[0]?.id));
    return target ? toDraft(target) : emptyDraft();
  });
  const [isNewMode, setIsNewMode] = React.useState<boolean>(false);

  const [keyDraft, setKeyDraft] = React.useState('');
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [isLoadingKey, setIsLoadingKey] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  
  const [isEditingProviderName, setIsEditingProviderName] = React.useState(false);

  // Model editing state
  const [newModelName, setNewModelName] = React.useState('');
  const [isAddingModel, setIsAddingModel] = React.useState(false);
  const [editingModelModal, setEditingModelModal] = React.useState<{
    index: number;
    modelId: string;
    contextWindow: string;
  } | null>(null);

  const [modelContextWindows, setModelContextWindows] = React.useState<Record<string, string>>({
    'deepseek-v4-flash': '128000',
    'deepseek-chat': '128000',
    'glm-5.2': '1000000',
  });

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const officialProfile = React.useMemo(
    () => settings.apiProfiles.find((p) => p.id === DEFAULT_DEEPSEEK_ID || p.name.toLowerCase().includes('deepseek')),
    [settings.apiProfiles],
  );

  const customProfiles = React.useMemo(
    () => settings.apiProfiles.filter((p) => p.id !== officialProfile?.id),
    [settings.apiProfiles, officialProfile],
  );

  const activeProfile = React.useMemo(
    () => settings.apiProfiles.find((p) => p.id === settings.activeApiProfileId),
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

  const handleSelectProfile = (profile: ApiProfile) => {
    setIsNewMode(false);
    setSelectedId(profile.id);
    setEditing(toDraft(profile));
    setKeyDraft('');
    setShowApiKey(false);
    setError(null);
    setSaveState('idle');
    setIsAddingModel(false);
    setNewModelName('');
  };

  const handleStartAddProvider = () => {
    setIsNewMode(true);
    setSelectedId(null);
    setEditing(emptyDraft());
    setKeyDraft('');
    setShowApiKey(false);
    setError(null);
    setSaveState('idle');
    setIsAddingModel(false);
    setNewModelName('');
  };

  const handleSaveProviderName = async (newName: string) => {
    const updatedEditing = { ...editing, name: newName };
    setEditing(updatedEditing);
    setIsEditingProviderName(false);

    if (!isNewMode && editing.id) {
      try {
        const nextProfiles = settings.apiProfiles.map((p) =>
          p.id === editing.id ? { ...p, name: newName } : p
        );
        await saveProfiles(nextProfiles.map(apiProfilePatch), settings.activeApiProfileId);
        showSaved();
      } catch (err) {
        console.error('Failed to rename provider:', err);
      }
    }
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
      const currentEnabled = settings.enabledApiProfileIds ?? [settings.activeApiProfileId];
      const isAlreadyEnabled = currentEnabled.includes(id);
      let nextEnabled: string[];
      if (isAlreadyEnabled) {
        // Disable: remove from enabled list (but keep at least one)
        nextEnabled = currentEnabled.filter((eid) => eid !== id);
        if (nextEnabled.length === 0) {
          // Cannot disable all providers; keep this one
          nextEnabled = [id];
        }
        // If we're disabling the active profile, switch active to the first remaining enabled
        const patchData: Record<string, unknown> = { enabledApiProfileIds: nextEnabled };
        if (id === settings.activeApiProfileId) {
          patchData.activeApiProfileId = nextEnabled[0];
        }
        await patch(patchData as any);
      } else {
        // Enable: add to enabled list
        nextEnabled = [...currentEnabled, id];
        await patch({ enabledApiProfileIds: nextEnabled });
      }
      window.dispatchEvent(new Event('models:refresh'));
      showSaved();
    } catch (err) {
      setError((err as Error).message || 'Failed to toggle profile');
      setSaveState('idle');
    }
  };

  const handleDelete = async (id: string) => {
    if (settings.apiProfiles.length <= 1) return;
    const target = settings.apiProfiles.find((p) => p.id === id);
    if (!target || !window.confirm(`Delete provider "${target.name}"?`)) return;

    setSaveState('saving');
    setError(null);
    try {
      const nextProfiles = settings.apiProfiles
        .filter((p) => p.id !== id)
        .map(apiProfilePatch);
      const nextActiveId = id === settings.activeApiProfileId ? nextProfiles[0].id : settings.activeApiProfileId;
      await saveProfiles(nextProfiles, nextActiveId);

      showSaved();
      const remainingTarget = settings.apiProfiles.find((p) => p.id !== id) || settings.apiProfiles[0];
      if (remainingTarget) {
        handleSelectProfile(remainingTarget);
      } else {
        handleStartAddProvider();
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to delete provider');
      setSaveState('idle');
    }
  };

  const handleToggleShowKey = async () => {
    if (showApiKey) {
      setShowApiKey(false);
      return;
    }

    if (!keyDraft && getApiProfileApiKey) {
      setIsLoadingKey(true);
      try {
        const fetchedKey = await getApiProfileApiKey(editing.id);
        if (fetchedKey) {
          setKeyDraft(fetchedKey);
        }
      } catch (err) {
        console.error('Failed to reveal API Key:', err);
      } finally {
        setIsLoadingKey(false);
      }
    }
    setShowApiKey(true);
  };

  const handleSave = async () => {
    if (!editing.name.trim()) {
      setError('Enter a provider name');
      return;
    }
    if (!editing.baseUrl.trim()) {
      setError('Enter a Base URL');
      return;
    }

    setSaveState('saving');
    setError(null);
    try {
      const existingIds = new Set(settings.apiProfiles.map((p) => p.id));
      const nextProfile = apiProfilePatch(editing);

      let nextActiveId = settings.activeApiProfileId;
      let nextProfiles: ApiProfilePatch[];

      if (existingIds.has(editing.id)) {
        nextProfiles = settings.apiProfiles.map((p) => (p.id === editing.id ? nextProfile : apiProfilePatch(p)));
      } else {
        nextProfiles = [...settings.apiProfiles.map(apiProfilePatch), nextProfile];
        nextActiveId = editing.id;
      }

      // When creating a new profile, automatically enable it
      const currentEnabled = settings.enabledApiProfileIds ?? [settings.activeApiProfileId];
      const nextEnabled = existingIds.has(editing.id)
        ? currentEnabled
        : [...currentEnabled, editing.id];

      const updated = await patch({
        apiProfiles: nextProfiles.map((p) => ({ ...p })),
        activeApiProfileId: nextActiveId,
        enabledApiProfileIds: nextEnabled,
      });
      window.dispatchEvent(new Event('models:refresh'));

      if (keyDraft.trim()) {
        await setApiProfileApiKey(editing.id, keyDraft.trim());
      }

      window.dispatchEvent(new Event('models:refresh'));
      showSaved();
      setIsNewMode(false);
      setSelectedId(editing.id);
      setEditing((prev) => ({ ...prev, apiKeySet: Boolean(keyDraft.trim() || prev.apiKeySet) }));
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
      setSaveState('idle');
    }
  };

  const handleAddModel = () => {
    const trimmed = newModelName.trim();
    if (!trimmed) return;
    if (editing.models.includes(trimmed)) {
      setNewModelName('');
      setIsAddingModel(false);
      return;
    }

    const nextModels = [...editing.models, trimmed];
    setEditing({
      ...editing,
      models: nextModels,
      defaultModel: editing.defaultModel || trimmed,
    });
    setNewModelName('');
    setIsAddingModel(false);
  };

  const handleRemoveModel = (modelToRemove: string) => {
    const nextModels = editing.models.filter((m) => m !== modelToRemove);
    setEditing({
      ...editing,
      models: nextModels,
      defaultModel: editing.defaultModel === modelToRemove ? (nextModels[0] || '') : editing.defaultModel,
    });
  };



  const handleRefresh = () => {
    window.dispatchEvent(new Event('models:refresh'));
    showSaved();
  };

  const enabledIds = new Set(settings.enabledApiProfileIds ?? [settings.activeApiProfileId]);
  const isCurrentEnabled = !isNewMode && enabledIds.has(editing.id);

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">模型设置</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            管理自定义模型供应商，配置后可在聊天时选择使用。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SavePill state={saveState} error={error} />
          <button
            type="button"
            onClick={handleRefresh}
            title="刷新供应商"
            aria-label="Refresh providers"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>

      {/* Main Two-Column Card Container */}
      <div className="flex flex-col md:flex-row min-h-[560px] rounded-2xl border border-gray-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181A] shadow-sm overflow-hidden">
        
        {/* Left Sidebar */}
        <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-gray-200/80 dark:border-zinc-800 bg-gray-50/60 dark:bg-[#141416] p-4 flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* DeepSeek (Official) Preset Provider */}
            {officialProfile && (
              <div>
                <p className="px-2 mb-2 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                  DeepSeek
                </p>
                <div
                  onClick={() => handleSelectProfile(officialProfile)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    !isNewMode && selectedId === officialProfile.id
                      ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-xs border border-gray-200/80 dark:border-zinc-700'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconDeepSeek size={20} className="shrink-0" />
                    <span className="truncate font-semibold text-[13.5px]">{officialProfile.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        officialProfile.apiKeySet ? 'bg-[#4D6BFE]' : 'bg-gray-300 dark:bg-zinc-600'
                      }`}
                      title={officialProfile.apiKeySet ? 'API Key 已配置' : 'API Key 未配置'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Custom Providers List */}
            <div>
              <p className="px-2 mb-2 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                自定义供应商
              </p>
              <div className="space-y-1">
                {customProfiles.map((p) => {
                  const isSelected = !isNewMode && selectedId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProfile(p)}
                      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-xs border border-gray-200/80 dark:border-zinc-700'
                          : 'text-gray-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconCube size={16} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                        <span className="truncate text-[13.5px]">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.apiKeySet ? 'bg-[#4D6BFE]' : 'bg-gray-300 dark:bg-zinc-600'
                          }`}
                          title={p.apiKeySet ? 'API Key 已配置' : 'API Key 未配置'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Provider Button */}
              <button
                type="button"
                onClick={handleStartAddProvider}
                className={`w-full mt-3 flex items-center justify-center gap-2 h-9 rounded-xl border border-gray-300/80 dark:border-zinc-700/80 text-xs font-semibold text-gray-700 dark:text-zinc-300 transition-all ${
                  isNewMode
                    ? 'bg-white dark:bg-zinc-800 border-blue-500 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'hover:bg-white dark:hover:bg-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600'
                }`}
              >
                <IconPlus size={14} />
                添加供应商
              </button>
            </div>
          </div>
        </div>

        {/* Right Main Form */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            
            {/* Form Top Toolbar Header matching screenshot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isNewMode ? '添加模型供应商' : editing.name}
                </h2>
                {!isNewMode && editing.id !== officialProfile?.id && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProviderName(true)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    title="修改供应商名称"
                  >
                    <IconEdit size={16} />
                  </button>
                )}
                {!isNewMode && (
                  <div className="inline-flex items-center p-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-medium border border-gray-200/80 dark:border-zinc-700 select-none">
                    <button
                      type="button"
                      onClick={() => { if (!isCurrentEnabled) handleActivate(editing.id); }}
                      className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isCurrentEnabled
                          ? 'bg-[#4D6BFE] text-white shadow-xs'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      启用
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (isCurrentEnabled) handleActivate(editing.id); }}
                      className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        !isCurrentEnabled
                          ? 'bg-[#4D6BFE] text-white shadow-xs'
                          : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      禁用
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Provider Trash Button on top right */}
              {!isNewMode && editing.id !== officialProfile?.id && settings.apiProfiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDelete(editing.id)}
                  title="删除供应商"
                  aria-label="Delete provider"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                >
                  <IconTrash size={18} />
                </button>
              )}
            </div>

            {isNewMode && (
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                配置一个完全自定义的 API 端点和初始模型。
              </p>
            )}

            {/* Form Inputs Grid */}
            <div className="space-y-4 max-w-2xl">
              
              {/* Name Input (when adding or editing) */}
              {isNewMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                    名称
                  </label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="如：DeepSeek"
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              )}

              {/* Base URL Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  Base URL
                </label>
                <input
                  type="text"
                  value={editing.baseUrl}
                  onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/anthropic"
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* API Format Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  API 格式
                </label>
                <CustomFormatSelect
                  value={editing.protocol}
                  onChange={(protocol) => setEditing({ ...editing, protocol })}
                />
              </div>

              {/* API Key Input with Eye Toggle Icon */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder={editing.apiKeySet && !keyDraft ? '••••••••••••••••••••••••••••••••' : '输入 API Key'}
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleToggleShowKey}
                    disabled={isLoadingKey}
                    title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                    className="absolute right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                  >
                    {showApiKey ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Model List Section matching screenshot layout */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  模型列表
                </label>

                {/* Model Items Container */}
                <div className="space-y-2">
                  {editing.models.map((model, idx) => {
                    const isDefault = model === editing.defaultModel;

                    return (
                      <div
                        key={`${model}-${idx}`}
                        className="flex items-center justify-between h-11 px-4 rounded-xl border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 shadow-2xs hover:border-gray-300 dark:hover:border-zinc-700 transition-all"
                      >
                        <span className="font-mono text-sm text-gray-800 dark:text-zinc-200">
                          {model}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Context size pill badge */}
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-100 dark:bg-zinc-700/60 text-gray-500 dark:text-zinc-400">
                            {formatContextWindow(modelContextWindows[model] || (model.includes('flash') || model.includes('5.2') ? '128000' : '64000'))}
                          </span>

                          {/* Test Connection / Default Model Button */}
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, defaultModel: model })}
                            title={isDefault ? '当前默认模型' : '测试连接并设为默认'}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-all"
                          >
                            <IconTestConnection size={16} />
                          </button>

                          {/* Edit Model Configuration Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const ctx = modelContextWindows[model] || (model.includes('flash') || model.includes('5.2') ? '128000' : '64000');
                              setEditingModelModal({
                                index: idx,
                                modelId: model,
                                contextWindow: ctx,
                              });
                            }}
                            title="编辑模型配置"
                            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-all"
                          >
                            <IconEdit size={14} />
                          </button>

                          {/* Remove Model Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveModel(model)}
                            title="删除模型"
                            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-all"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Add Model Input Form */}
                {isAddingModel ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddModel();
                        }
                      }}
                      placeholder="如：deepseek-v4-flash"
                      autoFocus
                      className="flex-1 h-9 px-3 rounded-xl border border-blue-500 bg-white dark:bg-zinc-800 text-xs font-mono text-gray-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddModel}
                      className="h-9 px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingModel(false);
                        setNewModelName('');
                      }}
                      className="h-9 px-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingModel(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-300 transition-colors"
                  >
                    <IconPlus size={14} />
                    添加模型
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Form Save Button Footer */}
          <div className="pt-6 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="h-10 px-6 rounded-xl bg-[#4A4B50] hover:bg-[#38393D] dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
            >
              {isNewMode ? '添加供应商' : '保存供应商'}
            </button>
          </div>
        </div>
      </div>

      {editingModelModal && (
        <EditModelModal
          modelId={editingModelModal.modelId}
          contextWindow={editingModelModal.contextWindow}
          onClose={() => setEditingModelModal(null)}
          onSave={(newModelId, newContextWindow) => {
            const oldModel = editing.models[editingModelModal.index];
            const nextModels = [...editing.models];
            nextModels[editingModelModal.index] = newModelId;

            setModelContextWindows((prev) => ({
              ...prev,
              [newModelId]: newContextWindow,
            }));

            setEditing({
              ...editing,
              models: nextModels,
              defaultModel: editing.defaultModel === oldModel ? newModelId : editing.defaultModel,
            });
            setEditingModelModal(null);
          }}
        />
      )}

      {isEditingProviderName && (
        <EditProviderNameModal
          initialName={editing.name}
          onClose={() => setIsEditingProviderName(false)}
          onSave={handleSaveProviderName}
        />
      )}
    </div>
  );
};

export default ModelsSection;
