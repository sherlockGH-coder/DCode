import React from 'react';
import type { Attachment } from '../../../shared/types';

export const ABS_PATH_RE = /^(?:~?\/[^\s]+|[A-Za-z]:[\\/][^\s]+)$/;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function kindIcon(kind: Attachment['kind']): string {
  switch (kind) {
    case 'image': return '🖼';
    case 'audio': return '🎵';
    case 'video': return '🎬';
    default:      return '📄';
  }
}

const WARN_THRESHOLD_TEXT = 1 * 1024 * 1024;
const WARN_THRESHOLD_DOC = 10 * 1024 * 1024;

function isDocMime(mime: string): boolean {
  return mime === 'application/pdf'
    || mime.includes('officedocument')
    || mime === 'application/msword'
    || mime === 'application/vnd.ms-excel';
}

export function attachmentWarning(a: Attachment): string | null {
  const isDoc = isDocMime(a.mimeType);
  const limit = isDoc ? WARN_THRESHOLD_DOC : WARN_THRESHOLD_TEXT;
  if (a.size > limit) {
    return isDoc
      ? `${a.name} 较大 (${formatBytes(a.size)})，解析后可能超出模型上下文`
      : `${a.name} 较大 (${formatBytes(a.size)})，可能超出模型上下文。建议改用 grep 检索关键内容`;
  }
  if (a.kind === 'image' || a.kind === 'audio' || a.kind === 'video') {
    return `当前 DeepSeek 模型不支持 ${a.kind}，模型只能看到路径与元信息`;
  }
  return null;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function insertTextAtSelection(value: string, text: string, start: number, end: number): { value: string; cursor: number } {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
  const insertion = `${needsLeadingSpace ? ' ' : ''}${text.trim()}${needsTrailingSpace ? ' ' : ''}`;
  const cursor = before.length + insertion.length;
  return {
    value: before + insertion + after,
    cursor,
  };
}

export type SlashCommand = {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  kind: 'text' | 'action';
  action?: () => void;
};

export type SelectedSlashCommand = Pick<SlashCommand, 'name' | 'description' | 'icon'>;

type SlashTrigger = {
  filter: string;
  prefix: string;
  start: number;
};

export function findSlashTrigger(value: string, cursorPos: number): SlashTrigger | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match) return null;

  return {
    filter: match[1],
    prefix: match[0].startsWith(' ') ? ' ' : '',
    start: cursorPos - match[0].length,
  };
}

export function removeSlashTrigger(value: string, cursorPos: number): { value: string; cursor: number } {
  const trigger = findSlashTrigger(value, cursorPos);
  if (!trigger) return { value, cursor: cursorPos };

  const before = value.slice(0, trigger.start);
  const after = value.slice(cursorPos);
  const normalizedAfter = (trigger.prefix || before.length === 0) ? after.replace(/^\s+/, '') : after;
  const cursor = before.length + trigger.prefix.length;
  return {
    value: before + trigger.prefix + normalizedAfter,
    cursor,
  };
}

export function buildSlashCommandPayload(command: SelectedSlashCommand | null, body: string): string {
  const text = body.trim();
  if (!command) return text;
  return text ? `/${command.name} ${text}` : `/${command.name}`;
}

export function normalizeContextUsagePercent(percent?: number | null): number | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function formatCompactSlashCommandDescription(percent?: number | null): string {
  const normalized = normalizeContextUsagePercent(percent);
  return normalized === null
    ? '压缩此会话的上下文'
    : `压缩此会话的上下文（已使用 ${normalized}%）`;
}

export const BUILTIN_SLASH_COMMAND_NAMES = ['compact', 'plan', 'help'] as const;

export const CompactContextRing: React.FC<{ percent?: number | null }> = ({ percent }) => {
  const normalized = normalizeContextUsagePercent(percent) ?? 0;
  const label = `当前上下文已使用 ${normalized}%`;

  return (
    <svg
      data-testid="slash-command-compact-ring"
      aria-label={label}
      role="img"
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      className="shrink-0 text-[#111113] dark:text-white"
    >
      <circle
        cx="9"
        cy="9"
        r="6.6"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="3.4"
      />
      <circle
        cx="9"
        cy="9"
        r="6.6"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${normalized} 100`}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
};
