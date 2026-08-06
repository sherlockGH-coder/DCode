import React, { useCallback, useState } from 'react';
import type { McpScope, McpServerStatus } from '../../../shared/types';
import { IconEdit, IconTrash, IconHistory, IconChevronDown, IconCopy, IconCheck } from '../icons';
import { ToggleSwitch } from '../settings/SettingsPrimitives';

interface Props {
  server: McpServerStatus;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestart: () => void;
  extraContent?: React.ReactNode;
}

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

/** Status dot + label styling derived from the runtime state. */
const statusTone = (server: McpServerStatus): { dot: string; label: string; text: string } => {
  if (!server.enabled) {
    return { dot: 'bg-[#B8B8BE] opacity-60', label: 'Disabled', text: 'text-text-tertiary' };
  }
  switch (server.status) {
    case 'connected':
      return {
        dot: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
        label: 'Running',
        text: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'starting':
      return {
        dot: 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.14)]',
        label: 'Starting…',
        text: 'text-amber-700 dark:text-amber-400',
      };
    case 'error':
      return {
        dot: 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]',
        label: server.lastError ?? 'Error',
        text: 'text-red-600 dark:text-red-400',
      };
    default:
      return { dot: 'bg-[#B8B8BE] opacity-60', label: 'Stopped', text: 'text-text-tertiary' };
  }
};

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

const ServerCard: React.FC<Props> = ({ server, onToggle, onEdit, onDelete, onRestart, extraContent }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  const tone = statusTone(server);
  const isError = server.enabled && server.status === 'error';

  const handleCopyCommand = useCallback(async () => {
    const text =
      server.config.transport === 'stdio'
        ? [server.config.command, ...(server.config.args ?? [])].join(' ')
        : server.config.url;
    await copyToClipboard(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1600);
  }, [server.config]);

  const handleCopyTool = useCallback(async (tool: { name: string; namespacedName: string }) => {
    await copyToClipboard(tool.namespacedName);
    setCopiedTool(tool.name);
    setTimeout(() => setCopiedTool((cur) => (cur === tool.name ? null : cur)), 1600);
  }, []);

  return (
    <div
      className={`group flex flex-col border-t border-black/[0.055] px-4 py-3 transition-colors first:border-t-0 hover:bg-bg-block/60 dark:border-white/[0.07] ${
        server.enabled ? '' : 'opacity-55'
      }`}
    >
      <div className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-2.5">
        <button
          type="button"
          className="flex h-6 w-full cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-secondary"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <IconChevronDown size={13} className={`transition-transform duration-150 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
            <span className="truncate text-[14px] font-semibold text-text-primary">{server.name}</span>
            <ScopeBadge scope={server.scope} />
          </div>
          <div className="mt-[3px] flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-text-secondary">
            <span className="shrink-0">{server.config.transport}</span>
            <span className="shrink-0 text-text-tertiary">·</span>
            <span className="truncate">{commandSummary(server)}</span>
            <span className="shrink-0 text-text-tertiary">·</span>
            <span className={`max-w-[45%] shrink-0 truncate ${tone.text}`}>{tone.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 opacity-40 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
          <span className="mr-0.5 shrink-0 rounded-[6px] bg-bg-chip px-1.5 py-[2px] font-mono text-[10.5px] font-medium text-text-secondary">
            {server.tools.length} tools
          </span>
          <button
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary ${
              isError ? 'text-accent' : ''
            }`}
            onClick={onRestart}
            title="Reconnect"
          >
            <IconHistory size={14} className="text-current" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            onClick={onEdit}
            title="Settings"
          >
            <IconEdit size={15} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-rose-500/[0.08] hover:text-rose-600 dark:hover:text-rose-300"
            onClick={onDelete}
            title="Delete"
          >
            <IconTrash size={15} />
          </button>
        </div>

        <div className="border-l border-black/[0.06] pl-3 dark:border-white/[0.07]">
          <ToggleSwitch
            checked={server.enabled}
            onChange={onToggle}
            label={`${server.name} enabled`}
          />
        </div>
      </div>

      {expanded && (
        <div className="ml-[38px] mt-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-[7px] bg-bg-block px-3 py-2">
            <span className="min-w-0 break-all font-mono text-[11.5px] leading-relaxed text-text-secondary">
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
            </span>
            <button
              type="button"
              onClick={handleCopyCommand}
              title={copiedCmd ? 'Copied to clipboard' : 'Copy command'}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-none bg-transparent text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              {copiedCmd ? (
                <IconCheck size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <IconCopy size={12} className="shrink-0" />
              )}
            </button>
          </div>

          {server.tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {server.tools.map((t) => (
                <button
                  key={t.namespacedName}
                  type="button"
                  onClick={() => handleCopyTool(t)}
                  title={
                    copiedTool === t.name
                      ? 'Copied to clipboard'
                      : t.description
                        ? `${t.namespacedName} — ${t.description}`
                        : t.namespacedName
                  }
                  className="group/pill inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded-[5px] border border-transparent bg-bg-block px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text-primary"
                >
                  <span className="truncate">{t.namespacedName}</span>
                  {copiedTool === t.name ? (
                    <IconCheck size={10} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <IconCopy
                      size={9}
                      className="shrink-0 opacity-0 transition-opacity group-hover/pill:opacity-100"
                    />
                  )}
                </button>
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
