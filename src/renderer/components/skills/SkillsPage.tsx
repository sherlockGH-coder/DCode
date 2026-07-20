import React, { useMemo, useState } from 'react';
import type { SkillScope, SkillSummary } from '../../../shared/types';
import { useSkills } from '../../hooks/useSkills';
import SkillCard from './SkillCard';
import SkillEditorModal from './SkillEditorModal';
import { IconPlus, IconFolder } from '../icons';
import {
  PrimaryButton,
  SecondaryButton,
} from '../settings/SettingsPrimitives';

interface Props {
  activeProject: string | null;
}

interface GroupSpec {
  scope: SkillScope;
  title: string;
  writable: boolean;
}

const GROUPS: GroupSpec[] = [
  { scope: 'builtin', title: '内置', writable: false },
  { scope: 'user', title: '全局', writable: true },
];

const SkillsPage: React.FC<Props> = ({ activeProject }) => {
  const { skills, isLoading, toggle, read, write, remove, openDir } = useSkills(activeProject);
  const [editor, setEditor] = useState<{ scope: 'user' | 'project'; initial: SkillSummary | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ scope: 'user' | 'project'; name: string } | null>(null);

  const grouped = useMemo(() => {
    const m: Record<SkillScope, SkillSummary[]> = { builtin: [], user: [], project: [] };
    for (const s of skills) m[s.scope].push(s);
    return m;
  }, [skills]);

  const handleSave = async (
    scope: 'user' | 'project',
    payload: { name: string; description: string; allowedTools?: string[]; body: string },
  ) => {
    return write(scope, payload);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await remove(confirmDelete.scope, confirmDelete.name);
    setConfirmDelete(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 py-9 sm:px-10">
      {/* Header */}
      <div className="relative mb-10 flex min-h-[44px] items-center gap-3">
        <h2 className="text-[24px] font-semibold text-[#1D2127] dark:text-white">技能</h2>
        <div className="ml-auto">
          <SecondaryButton
            type="button"
            onClick={() => openDir('user')}
          >
            <IconFolder size={14} className="text-current" />
            <span>管理文件</span>
          </SecondaryButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-[8px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:border-white/[0.08] dark:bg-[#1E1E20]">
          <p className="text-[13px] font-medium text-[#8E8E93] dark:text-white/42">加载技能...</p>
        </div>
      ) : (
        GROUPS.map((g) => {
          const items = grouped[g.scope];

          return (
            <section key={g.scope} className="mb-9 last:mb-0">
              {/* Section Header */}
              <div className="mb-3.5 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[15px] font-semibold text-[#1D2127] dark:text-white">{g.title}</h3>
                  <span className="inline-flex h-5 items-center rounded-[8px] bg-black/[0.045] px-2 text-[12px] font-semibold text-[#8E8E93] dark:bg-white/[0.06] dark:text-white/45">
                    {items.length} 项
                  </span>
                </div>
                {g.writable && (
                  <PrimaryButton
                    type="button"
                    onClick={() => setEditor({ scope: g.scope as 'user' | 'project', initial: null })}
                  >
                    <IconPlus size={13} className="text-current" />
                    <span>新建</span>
                  </PrimaryButton>
                )}
              </div>

              {items.length === 0 ? (
                <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[8px] border border-black/[0.08] bg-white px-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:border-white/[0.08] dark:bg-[#1E1E20]">
                  <p className="text-[13px] font-medium text-[#8E8E93] dark:text-white/42">
                    {g.scope === 'builtin' ? '暂无内置技能' : '暂无自定义技能'}
                  </p>
                  {g.writable && (
                    <button
                      type="button"
                      className="mt-2 text-[12.5px] font-semibold text-[#147CE5] transition-colors hover:text-[#0A66C2]"
                      onClick={() => setEditor({ scope: g.scope as 'user' | 'project', initial: null })}
                    >
                      创建第一个
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {items.map((s) => (
                    <SkillCard
                      key={`${s.scope}-${s.name}`}
                      skill={s}
                      onToggle={toggle}
                      onEdit={g.writable ? (skill) => setEditor({ scope: g.scope as 'user' | 'project', initial: skill }) : undefined}
                      onDelete={g.writable ? (skill) => setConfirmDelete({ scope: g.scope as 'user' | 'project', name: skill.name }) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {editor && (
        <SkillEditorModal
          scope={editor.scope}
          initial={editor.initial}
          loadFull={read}
          onClose={() => setEditor(null)}
          onSave={(payload) => handleSave(editor.scope, payload)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div
            className="w-[400px] max-w-[90vw] rounded-[10px] border border-black/[0.08] bg-white px-6 py-5 shadow-2xl dark:border-white/[0.08] dark:bg-[#1E1E20]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-[17px] font-semibold text-text-primary">确认删除</h3>
            <p className="mb-6 text-[13px] leading-relaxed text-text-secondary">
              永久删除 <span className="font-semibold text-text-primary">{confirmDelete.name}</span>？
            </p>
            <div className="flex justify-end gap-3">
              <SecondaryButton
                type="button"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </SecondaryButton>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-[7px] bg-red-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
                onClick={handleDelete}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsPage;
