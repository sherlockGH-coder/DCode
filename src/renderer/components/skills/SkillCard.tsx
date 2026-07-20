import React from 'react';
import type { SkillSummary } from '../../../shared/types';
import { IconEdit, IconTrash } from '../icons';
import { IconLayers } from '../icons';
import { ToggleSwitch } from '../settings/SettingsPrimitives';

interface Props {
  skill: SkillSummary;
  onToggle: (name: string, enabled: boolean) => void;
  onEdit?: (skill: SkillSummary) => void;
  onDelete?: (skill: SkillSummary) => void;
}

const SkillCard: React.FC<Props> = ({ skill, onToggle, onEdit, onDelete }) => {
  const isBuiltin = skill.scope === 'builtin';

  return (
    <div
      className={`group relative flex items-start gap-3.5 rounded-[8px] border bg-white px-4 py-4 transition-all duration-150 ${
        skill.enabled
          ? 'border-black/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.025)] hover:border-black/[0.13] hover:bg-[#FAFBFC] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
          : 'border-black/[0.05] opacity-55 grayscale shadow-none'
      } dark:border-white/[0.08] dark:bg-[#1E1E20] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.03]`}
    >
      {/* Icon */}
      <div
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] ${
          isBuiltin
            ? 'bg-[#ebf2fc] text-[#3897F8] dark:bg-blue-500/[0.15] dark:text-blue-300'
            : 'bg-[#F1F1F3] text-[#6B7280] dark:bg-white/[0.08] dark:text-white/55'
        }`}
      >
        <IconLayers size={18} className="text-current" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#1D2127] dark:text-white">
            {skill.name}
          </span>
          {isBuiltin && (
            <span className="shrink-0 rounded-[4px] bg-[#ebf2fc] px-[5px] py-[1px] text-[9px] font-bold uppercase tracking-[0.4px] text-[#3897F8] dark:bg-blue-500/[0.15] dark:text-blue-300">
              Built-in
            </span>
          )}
        </div>

        {skill.description && (
          <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#8A9099] dark:text-white/38">
            {skill.description}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {skill.allowedTools && skill.allowedTools.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              <span className="text-[9px] opacity-60">●</span>
              {skill.allowedTools.length} 个工具
            </span>
          )}
          {skill.name === 'claude-design' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#ebf2fc] px-[7px] py-[2px] text-[11px] font-medium text-[#3897F8] dark:bg-blue-500/[0.1] dark:text-blue-300">
              <span className="text-[9px] opacity-60">●</span>
              design
            </span>
          )}
          {skill.name === 'git-autocommit' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              git
            </span>
          )}
          {skill.name === 'docx' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              document
            </span>
          )}
          {skill.name === 'pptx' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              presentation
            </span>
          )}
          {skill.name === 'twitter-fetch' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              social
            </span>
          )}
          {skill.name === 'grill-me' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              planning
            </span>
          )}
          {skill.name === 'web-search' && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F1F1F3] px-[7px] py-[2px] text-[11px] font-medium text-[#6B7280] dark:bg-white/[0.08] dark:text-white/45">
              search
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        {onEdit && (
          <button
            type="button"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#9CA3AF] transition-colors hover:bg-black/[0.04] hover:text-[#4B5563] dark:text-white/28 dark:hover:bg-white/[0.06] dark:hover:text-white/50"
            onClick={() => onEdit(skill)}
            title="编辑"
          >
            <IconEdit size={14} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-[#9CA3AF] transition-colors hover:bg-rose-500/[0.08] hover:text-rose-600 dark:text-white/28 dark:hover:bg-rose-500/[0.12] dark:hover:text-rose-300"
            onClick={() => onDelete(skill)}
            title="删除"
          >
            <IconTrash size={14} />
          </button>
        )}
        <div className="ml-1.5 border-l border-black/[0.06] pl-2.5 dark:border-white/[0.07]">
          <ToggleSwitch
            checked={skill.enabled}
            onChange={(checked) => onToggle(skill.name, checked)}
            label={`${skill.name} 启用状态`}
          />
        </div>
      </div>
    </div>
  );
};

export default SkillCard;
