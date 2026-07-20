import React, { useMemo, useState } from 'react';
import type { McpScope, McpServerConfig, McpServerStatus } from '../../../shared/types';
import { useMcp } from '../../hooks/useMcp';
import ServerCard from './ServerCard';
import ServerEditorModal from './ServerEditorModal';
import { IconPlus } from '../icons';
import {
  PrimaryButton,
  SecondaryButton,
  SettingsGroup,
  SettingsPageHeader,
} from '../settings/SettingsPrimitives';

interface Props {
  activeProject: string | null;
}

const StatusChip: React.FC<{ dot?: string; label: string }> = ({ dot, label }) => (
  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-bg-chip px-2.5 text-[12px] font-medium text-text-secondary">
    {dot && <span className={`h-[6px] w-[6px] rounded-full ${dot}`} />}
    {label}
  </span>
);

const PluginsPage: React.FC<Props> = ({ activeProject }) => {
  const { servers, isLoading, add, update, remove, toggle, restart } = useMcp(activeProject);
  const [editor, setEditor] = useState<{ scope: McpScope; initial: McpServerStatus | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ scope: McpScope; name: string } | null>(null);

  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => a.name.localeCompare(b.name));
  }, [servers]);

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = { connected: 0, starting: 0, error: 0, idle: 0, stopped: 0 };
    for (const s of servers) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [servers]);

  const handleSave = async (scope: McpScope, name: string, config: McpServerConfig): Promise<boolean> => {
    if (editor?.initial) {
      return update(scope, name, config);
    }
    return add(scope, name, config);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await remove(confirmDelete.scope, confirmDelete.name);
    setConfirmDelete(null);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-body text-text-primary">
      <div className="mx-auto w-full max-w-[980px] px-6 py-9 sm:px-10">
        <SettingsPageHeader
          title="MCP 服务器"
          description="管理工具服务器和连接状态"
          action={
            <PrimaryButton
            type="button"
            onClick={() => setEditor({ scope: activeProject ? 'project' : 'user', initial: null })}
          >
            <IconPlus size={14} className="text-current" />
            <span>添加服务器</span>
            </PrimaryButton>
          }
        />

        {!isLoading && sortedServers.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusChip dot="bg-emerald-500" label={`${statusSummary.connected} 已连接`} />
            {statusSummary.starting > 0 && (
              <StatusChip dot="bg-amber-500 animate-[thinking-pulse_1.6s_ease-in-out_infinite]" label={`${statusSummary.starting} 启动中`} />
            )}
            {statusSummary.error > 0 && (
              <StatusChip dot="bg-red-500" label={`${statusSummary.error} 错误`} />
            )}
            <StatusChip label={`共 ${sortedServers.length} 台`} />
          </div>
        )}

        {isLoading ? (
          <SettingsGroup className="flex min-h-[220px] items-center justify-center">
            <p className="text-[13px] font-medium text-text-tertiary">加载 MCP 配置...</p>
          </SettingsGroup>
        ) : sortedServers.length === 0 ? (
          <SettingsGroup className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
            <p className="mb-3 text-[13px] font-medium text-text-tertiary">暂无 MCP 服务器</p>
            <PrimaryButton
              type="button"
              onClick={() => setEditor({ scope: activeProject ? 'project' : 'user', initial: null })}
            >
              <IconPlus size={14} className="text-current" />
              添加服务器
            </PrimaryButton>
          </SettingsGroup>
        ) : (
          <SettingsGroup>
            {sortedServers.map((s) => (
              <ServerCard
                key={`${s.scope}-${s.name}`}
                server={s}
                onToggle={(enabled) => toggle(s.scope, s.name, enabled)}
                onEdit={() => setEditor({ scope: s.scope, initial: s })}
                onDelete={() => setConfirmDelete({ scope: s.scope, name: s.name })}
                onRestart={() => restart(s.scope, s.name)}
              />
            ))}
          </SettingsGroup>
        )}


      </div>

      {editor && (
        <ServerEditorModal
          scope={editor.scope}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSave={(name, config) => handleSave(editor.scope, name, config)}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-[400px] max-w-full rounded-[10px] border border-hairline bg-bg-body p-6 shadow-[var(--shadow-floating)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-[17px] font-semibold text-text-primary">移除服务器</h3>
            <p className="mb-7 text-[13px] leading-relaxed text-text-secondary">
              确认移除 <span className="rounded-md border border-rose-500/15 bg-rose-500/[0.08] px-1.5 py-0.5 font-mono font-medium text-rose-600">{confirmDelete.name}</span>？
              这会停止运行中的 MCP 进程并从配置文件中删除。
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                onClick={handleDelete}
              >
                确认移除
              </button>
              <SecondaryButton
                type="button"
                className="w-full"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsPage;
