import React, { useState } from 'react';
import type { McpScope, McpServerStatus, McpStatus } from '../../../shared/types';
import { IconEdit, IconTrash, IconHistory, IconChevronDown } from '../icons';
import { ToggleSwitch } from '../settings/SettingsPrimitives';

interface Props {
  server: McpServerStatus;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestart: () => void;
  extraContent?: React.ReactNode;
}

const STATUS_DOT: Record<McpStatus, string> = {
  idle: 'bg-[#B8B8BE]',
  starting: 'bg-amber-500 animate-[thinking-pulse_1.6s_ease-in-out_infinite]',
  connected: 'bg-emerald-500',
  error: 'bg-red-500',
  stopped: 'bg-[#B8B8BE]',
};

const ScopeBadge: React.FC<{ scope: McpScope }> = ({ scope }) => {
  const isProject = scope === 'project';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-[1px] text-[11px] font-semibold leading-4 ${
        isProject
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'bg-accent-bg text-accent'
      }`}
    >
      {isProject ? 'project' : 'user'}
    </span>
  );
};

const commandSummary = (server: McpServerStatus): string => {
  if (server.config.transport === 'stdio') {
    const args = server.config.args?.slice(0, 2).join(' ') ?? '';
    const tail = (server.config.args?.length ?? 0) > 2 ? ' …' : '';
    return `${server.config.command}${args ? ` ${args}${tail}` : ''}`;
  }
  return server.config.url;
};

const ServerCard: React.FC<Props> = ({ server, onToggle, onEdit, onDelete, onRestart, extraContent }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flex flex-col border-t border-black/[0.055] px-4 py-3 transition-colors first:border-t-0 hover:bg-bg-block/60 dark:border-white/[0.07] ${
        server.enabled ? '' : 'opacity-50'
      }`}
    >
      <div className="grid grid-cols-[20px_8px_minmax(0,1fr)_auto_auto] items-center gap-2.5">
        <button
          type="button"
          className="flex h-6 w-full cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-secondary"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? '折叠' : '展开'}
        >
          <IconChevronDown size={13} className={`transition-transform duration-150 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        </button>

        <span
          className={`h-2 w-2 rounded-full ${STATUS_DOT[server.status]}`}
          title={server.status}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-text-primary">{server.name}</span>
            <ScopeBadge scope={server.scope} />
          </div>
          <div className="mt-[3px] flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-text-secondary">
            <span className="shrink-0">{server.tools.length} 个工具</span>
            <span className="shrink-0 text-text-tertiary">·</span>
            <span className="shrink-0">{server.config.transport}</span>
            <span className="shrink-0 text-text-tertiary">·</span>
            <span className="truncate">{server.enabled ? commandSummary(server) : '已停用'}</span>
            {server.lastError && (
              <>
                <span className="shrink-0 text-text-tertiary">·</span>
                <span className="truncate text-red-600 dark:text-red-400">{server.lastError}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            onClick={onRestart}
            title="重启"
          >
            <IconHistory size={14} className="text-current" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            onClick={onEdit}
            title="编辑"
          >
            <IconEdit size={15} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-rose-500/[0.08] hover:text-rose-600 dark:hover:text-rose-300"
            onClick={onDelete}
            title="移除"
          >
            <IconTrash size={15} />
          </button>
        </div>

        <div className="border-l border-black/[0.06] pl-3 dark:border-white/[0.07]">
          <ToggleSwitch
            checked={server.enabled}
            onChange={onToggle}
            label={`${server.name} 启用状态`}
          />
        </div>
      </div>

      {expanded && (
        <div className="ml-[38px] mt-2.5 flex flex-col gap-2">
          <div className="break-all rounded-[7px] bg-bg-block px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text-secondary">
            {server.config.transport === 'stdio' ? (
              <>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{server.config.command}</span>
                {server.config.args && <span className="ml-1">{server.config.args.join(' ')}</span>}
                {server.config.cwd && (
                  <span className="ml-1 text-text-tertiary">
                    | <span className="text-amber-600 dark:text-amber-400">CWD</span> {server.config.cwd}
                  </span>
                )}
              </>
            ) : (
              <span className="text-accent">{server.config.url}</span>
            )}
          </div>

          {server.tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {server.tools.map((t) => (
                <span
                  key={t.namespacedName}
                  className="max-w-full truncate rounded-[5px] bg-bg-block px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-text-secondary"
                  title={t.description ? `${t.namespacedName}: ${t.description}` : t.namespacedName}
                >
                  {t.namespacedName}
                </span>
              ))}
            </div>
          )}

          {extraContent}
        </div>
      )}
    </div>
  );
};

export default ServerCard;
