import React, { useEffect, useState } from 'react';
import type { Skill, SkillSummary } from '../../../shared/types';
import { IconX } from '../icons';
import { PrimaryButton, SecondaryButton, settingsInputClass, settingsMonoInputClass } from '../settings/SettingsPrimitives';

interface Props {
  scope: 'user' | 'project';
  initial?: SkillSummary | null;
  loadFull: (name: string) => Promise<Skill | null>;
  onClose: () => void;
  onSave: (payload: { name: string; description: string; allowedTools?: string[]; body: string }) => Promise<boolean>;
}

const TITLE: Record<'user' | 'project', string> = {
  user: '全局技能',
  project: '项目技能',
};

const LABEL_CLS = 'mb-2 block text-[11px] font-semibold text-text-tertiary';
const TEXTAREA_CLS = `${settingsMonoInputClass} min-h-[180px] resize-y py-2`;

const SkillEditorModal: React.FC<Props> = ({ scope, initial, loadFull, onClose, onSave }) => {
  const isEditing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [allowedToolsRaw, setAllowedToolsRaw] = useState(initial?.allowedTools?.join(', ') ?? '');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    loadFull(initial.name).then((full) => {
      if (cancelled) return;
      if (full) setBody(full.body);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [initial, loadFull]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入技能名称');
      return;
    }
    if (!description.trim()) {
      setError('请输入技能描述');
      return;
    }
    setSaving(true);
    setError(null);
    const allowedTools = allowedToolsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await onSave({
      name: name.trim(),
      description: description.trim(),
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
      body,
    });
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('保存失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-[640px] max-w-full flex-col overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1E1E20]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <h2 className="text-[17px] font-semibold text-text-primary">
            {isEditing ? '编辑' : '新建'}{TITLE[scope]}
          </h2>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-black/[0.04] text-text-tertiary transition-colors hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            onClick={onClose}
            aria-label="关闭"
          >
            <IconX size={14} />
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#8A9099] dark:text-white/35">
            <p className="text-[13px] font-medium">加载技能...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>
                  名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isEditing}
                  placeholder="git-commit"
                  className={settingsMonoInputClass}
                />
                {isEditing && <p className="mt-1 text-[10px] text-text-tertiary italic">名称不可修改</p>}
              </div>

              <div>
                <label className={LABEL_CLS}>
                  允许工具
                </label>
                <input
                  type="text"
                  value={allowedToolsRaw}
                  onChange={(e) => setAllowedToolsRaw(e.target.value)}
                  placeholder="bash_exec, read_file"
                  className={settingsMonoInputClass}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>
                描述 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="当用户要求生成 commit message 时使用"
                className={settingsInputClass}
              />
            </div>

            <div className="flex flex-col gap-2 min-h-[200px]">
              <label className={LABEL_CLS}>
                指令正文 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="# 技能指令"
                className={TEXTAREA_CLS}
                style={{ tabSize: 2 }}
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-[12px] text-red-600 font-medium dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-black/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? '保存...' : '保存'}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
};

export default SkillEditorModal;
