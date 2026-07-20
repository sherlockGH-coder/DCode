import React from 'react';
import { IconCheck, IconCopy, IconEdit, IconTrash } from '../../../icons';
import type { ApiProfile } from '../../../../../shared/types';
import { getDefaultModelLabel, getModelSourceLabel, getProfileInitial } from './profileDraft';
import { IconButton, KeyBadge, PANEL_CLASS, ProtocolBadge } from './ProfileUi';

interface ProfileCardProps {
  profile: ApiProfile;
  active: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  active,
  canDelete,
  onActivate,
  onEdit,
  onDuplicate,
  onDelete,
}) => (
  <article
    className={`group relative overflow-hidden border-t border-black/[0.055] transition-all duration-150 first:border-t-0 dark:border-white/[0.07] ${
      active
        ? 'bg-[#F8FAFF] dark:bg-[#3897F8]/[0.07]'
        : 'hover:bg-[#F7F7F8] dark:hover:bg-white/[0.04]'
    }`}
  >
    {active && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#3897F8]" />}
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3.5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-semibold ${
          active
            ? 'bg-[#3897F8] text-white shadow-[0_2px_8px_rgba(56,151,248,0.24)]'
            : 'bg-[#F1F1F3] text-[#6B7280] dark:bg-white/[0.08] dark:text-white/55'
        }`}
      >
        {getProfileInitial(profile.name)}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-[13.5px] font-semibold text-text-primary">
            {profile.name}
          </h3>
          <ProtocolBadge protocol={profile.protocol} />
          <KeyBadge active={profile.apiKeySet} />
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-text-tertiary">{profile.baseUrl}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-text-tertiary">
          <span>{getModelSourceLabel(profile)}</span>
          <span className="hidden h-1 w-1 rounded-full bg-text-tertiary/40 sm:inline-flex" />
          <span className="truncate">
            默认 <span className="font-mono text-text-secondary">{getDefaultModelLabel(profile)}</span>
          </span>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        {profile.protocol === 'legacy-openai' ? (
          <span className="inline-flex h-7 items-center rounded-[7px] bg-amber-500/12 px-2.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
            {active ? '当前配置 · 需迁移' : '编辑后迁移'}
          </span>
        ) : active ? (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-[#3897F8]/10 px-2.5 text-[11.5px] font-semibold text-[#147CE5]">
            <IconCheck size={12} className="text-current" />
            使用中
          </span>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="inline-flex h-7 items-center rounded-[7px] border border-black/[0.08] bg-white px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all duration-150 hover:border-[#3897F8]/35 hover:text-[#147CE5] dark:border-white/[0.1] dark:bg-white/[0.05]"
          >
            设为当前
          </button>
        )}
        <div className="flex items-center gap-0.5 rounded-[7px] bg-black/[0.035] px-0.5 py-0.5 dark:bg-white/[0.06]">
          <IconButton label="编辑" onClick={onEdit}><IconEdit size={14} /></IconButton>
          <IconButton label="复制" onClick={onDuplicate}><IconCopy size={14} /></IconButton>
          <IconButton label="删除" onClick={onDelete} disabled={!canDelete} danger><IconTrash size={14} /></IconButton>
        </div>
      </div>
    </div>
  </article>
);

interface ProfileSummaryPanelProps {
  profile: ApiProfile | undefined;
  profileCount: number;
  onEditActive: () => void;
}

export const ProfileSummaryPanel: React.FC<ProfileSummaryPanelProps> = ({
  profile,
  profileCount,
  onEditActive,
}) => (
  <section className={`${PANEL_CLASS} p-4`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#3897F8]/10 text-[15px] font-semibold text-[#147CE5]">
          {getProfileInitial(profile?.name ?? '')}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-text-tertiary">当前配置</span>
            <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10.5px] font-semibold text-text-secondary dark:bg-white/[0.06]">
              {profileCount} 个配置
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold text-text-primary">
              {profile?.name ?? '未选择'}
            </h3>
            {profile && <KeyBadge active={profile.apiKeySet} />}
            {profile && <ProtocolBadge protocol={profile.protocol} />}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11.5px] text-text-tertiary">{profile?.baseUrl ?? '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:min-w-[360px] lg:grid-cols-3">
        <SummaryMetric label="默认模型" value={profile ? getDefaultModelLabel(profile) : '-'} />
        <SummaryMetric label="协议" value={profile?.protocol === 'legacy-openai' ? '需迁移' : 'Anthropic Messages'} />
        <button
          type="button"
          onClick={onEditActive}
          disabled={!profile}
          className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-[7px] border border-black/[0.08] bg-white text-[13px] font-semibold text-[#3A3A3C] transition-all duration-150 hover:border-[#3897F8]/35 hover:text-[#147CE5] disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white/75"
        >
          <IconEdit size={14} />
          编辑
        </button>
      </div>
    </div>
    {profile?.protocol === 'legacy-openai' && (
      <div className="mt-4 rounded-[9px] border border-amber-500/20 bg-amber-500/[0.08] px-3.5 py-3 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
        此配置来自旧版 OpenAI Chat Completions。为避免把 Anthropic 请求误发到旧端点，聊天与模型拉取已暂停；请编辑配置完成迁移。
      </div>
    )}
  </section>
);

const SummaryMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 rounded-[7px] bg-[#F1F1F3] px-3 py-2 dark:bg-white/[0.07]">
    <div className="text-[10.5px] font-semibold text-text-tertiary">{label}</div>
    <div className="mt-1 truncate font-mono text-[11.5px] font-medium text-text-primary">{value}</div>
  </div>
);
