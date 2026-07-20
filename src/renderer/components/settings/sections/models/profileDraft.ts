import type { ApiProfile, ApiProfilePatch } from '../../../../../shared/types';

export type DraftProfile = {
  id: string;
  name: string;
  protocol: ApiProfile['protocol'];
  baseUrl: string;
  models: string[];
  defaultModel: string;
  apiKeySet: boolean;
};

export type SaveState = 'idle' | 'saving' | 'saved';

export const INPUT_CLASS = 'h-8 w-full rounded-[7px] border border-transparent bg-[#F1F1F3] px-3 text-[13px] font-medium text-[#1D2127] outline-none transition-all placeholder:text-[#A1A1AA] hover:bg-[#ECECEF] focus:border-[#3897F8]/40 focus:bg-white focus:ring-4 focus:ring-[#3897F8]/10 dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/32 dark:hover:bg-white/[0.11] dark:focus:border-blue-400/45 dark:focus:bg-white/[0.1] dark:focus:ring-blue-400/[0.1]';

export const emptyDraft = (): DraftProfile => ({
  id: crypto.randomUUID?.() ?? `profile-${Date.now()}`,
  name: '',
  protocol: 'anthropic',
  baseUrl: '',
  models: [],
  defaultModel: '',
  apiKeySet: false,
});

export const toDraft = (profile: ApiProfile): DraftProfile => ({
  id: profile.id,
  name: profile.name,
  protocol: profile.protocol,
  baseUrl: profile.baseUrl,
  models: [...profile.models],
  defaultModel: profile.defaultModel,
  apiKeySet: profile.apiKeySet,
});

export function apiProfilePatch(profile: DraftProfile | ApiProfile): ApiProfilePatch {
  return {
    id: profile.id,
    name: profile.name.trim(),
    protocol: profile.protocol,
    baseUrl: profile.baseUrl.trim(),
    models: profile.models,
    defaultModel: profile.defaultModel.trim(),
  };
}

export function getProfileInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'P';
}

export function getModelSourceLabel(profile: Pick<ApiProfile, 'models'>): string {
  return profile.models.length > 0 ? `${profile.models.length} 个自定义模型` : '自动拉取模型';
}

export function getDefaultModelLabel(profile: Pick<ApiProfile, 'defaultModel'>): string {
  return profile.defaultModel || '按协议默认';
}
