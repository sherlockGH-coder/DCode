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

const PluginsPage: React.FC<Props> = ({ activeProject }) => {
  const { servers, isLoading, add, update, remove, toggle, restart } = useMcp(activeProject);
  const [editor, setEditor] = useState<{ scope: McpScope; initial: McpServerStatus | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ scope: McpScope; name: string } | null>(null);

  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => a.name.localeCompare(b.name));
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
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F8FA] text-text-primary dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[980px] px-6 py-9 sm:px-10">
        <SettingsPageHeader
          title="MCP servers"
          action={
            <PrimaryButton
            type="button"
            onClick={() => setEditor({ scope: activeProject ? 'project' : 'user', initial: null })}
          >
            <IconPlus size={14} className="text-current" />
            <span>Add server</span>
            </PrimaryButton>
          }
        />

        {isLoading ? (
          <SettingsGroup className="flex min-h-[220px] items-center justify-center">
            <p className="text-[13px] font-medium text-text-tertiary">Loading MCP configuration...</p>
          </SettingsGroup>
        ) : sortedServers.length === 0 ? (
          <SettingsGroup className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
            <p className="mb-3 text-[13px] font-medium text-text-tertiary">No MCP servers</p>
            <PrimaryButton
              type="button"
              onClick={() => setEditor({ scope: activeProject ? 'project' : 'user', initial: null })}
            >
              <IconPlus size={14} className="text-current" />
              Add server
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
            <h3 className="mb-2 text-[17px] font-semibold text-text-primary">Remove server</h3>
            <p className="mb-7 text-[13px] leading-relaxed text-text-secondary">
              Confirm removing <span className="rounded-md border border-rose-500/15 bg-rose-500/[0.08] px-1.5 py-0.5 font-mono font-medium text-rose-600">{confirmDelete.name}</span>?
              This stops the running MCP process and removes it from the configuration file.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                onClick={handleDelete}
              >
                Remove
              </button>
              <SecondaryButton
                type="button"
                className="w-full"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsPage;
