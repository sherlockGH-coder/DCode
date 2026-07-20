import React, { useState } from 'react';
import type { ToolItem } from '../../../shared/types';
import DiffView from '../preview/DiffView';
import { IconCopy } from '../icons';
import { ChevronGlyph, IconPencil } from './chrome';
import { copyText, getFileName } from './utils';

function isDeletedDiff(diff?: string): boolean {
  return !!diff && (/\bdeleted file mode\b/.test(diff) || /^\+\+\+ \/dev\/null/m.test(diff));
}

type FileChangeAction = 'created' | 'edited' | 'deleted';

function getFileChangeAction(item: Extract<ToolItem, { kind: 'write' | 'edit' }>): FileChangeAction {
  if (isDeletedDiff(item.diff)) return 'deleted';
  if (item.kind === 'write' && item.isNew) return 'created';
  return 'edited';
}

const FILE_CHANGE_LABEL: Record<FileChangeAction, string> = {
  created: '已创建',
  edited: '已编辑',
  deleted: '已删除',
};

function getDiffStats(item: Extract<ToolItem, { kind: 'write' | 'edit' }>): { added: number; deleted: number } {
  if (item.kind === 'edit') {
    return {
      added: item.linesAdded ?? 0,
      deleted: item.linesDeleted ?? 0,
    };
  }
  if (!item.diff) return { added: 0, deleted: 0 };
  let added = 0;
  let deleted = 0;
  for (const line of item.diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) deleted++;
  }
  return { added, deleted };
}

const DiffStat: React.FC<{ added: number; deleted: number }> = ({ added, deleted }) => (
  <span className="ml-1 shrink-0 font-mono text-[12.5px]">
    <span className="text-diff-add">+{added}</span>
    <span className="ml-1 text-diff-del">-{deleted}</span>
  </span>
);

const FileChangeDetail: React.FC<{
  item: Extract<ToolItem, { kind: 'write' | 'edit' }>;
  added: number;
  deleted: number;
}> = ({ item, added, deleted }) => {
  const fileName = getFileName(item.path);

  return (
    <div data-testid="file-change-detail" className="mt-1.5 ml-2">
      <div className="overflow-hidden">
        <div className="flex h-8 items-center gap-2 border-b border-hairline px-3 text-[12.5px] text-text-secondary">
          <span className="min-w-0 truncate font-mono">{fileName}</span>
          <DiffStat added={added} deleted={deleted} />
          <button
            type="button"
            title="复制 diff"
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-[6px] border-0 bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            onClick={async () => {
              if (!item.diff) return;
              await copyText(item.diff);
            }}
          >
            <IconCopy size={13} />
          </button>
        </div>
        {item.diff ? (
          <DiffView diff={item.diff} filename={item.path} maxHeight="360px" className="border-0" />
        ) : (
          <div className="px-4 py-4 text-[12px] text-text-tertiary">无可见代码改动</div>
        )}
      </div>
    </div>
  );
};

const FileChangeToolCard: React.FC<{
  item: Extract<ToolItem, { kind: 'write' | 'edit' }>;
  onFileClick: (event: React.MouseEvent) => void;
  hideIcon?: boolean;
}> = ({ item, onFileClick, hideIcon = false }) => {
  const [open, setOpen] = useState(false);
  const action = getFileChangeAction(item);
  const isRunning = item.status === 'running' || item.status === 'pending';
  const label = isRunning ? (action === 'created' ? '创建中' : action === 'deleted' ? '删除中' : '编辑中') : FILE_CHANGE_LABEL[action];
  const { added, deleted } = getDiffStats(item);
  const fileName = getFileName(item.path);
  const hasDetail = !!item.diff;
  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center w-full">
        <button
          data-testid="tool-item-row"
          type="button"
          onClick={hasDetail ? () => setOpen((value) => !value) : undefined}
          className={`tool-item-row-surface group/summary-row flex min-h-6 h-7 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left transition-colors duration-150 ${
            isRunning ? 'text-text-secondary' : 'text-text-secondary hover:text-text-primary'
          } ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={hasDetail ? open : undefined}
        >
          {!hideIcon && (
            <span
              data-testid="tool-item-kind-icon"
              data-tool-icon="pencil"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-75"
            >
              <IconPencil size={15} />
            </span>
          )}
          <span className="shrink-0 text-[13.5px] text-current">{label}</span>
          <span
            onClick={onFileClick}
            className="min-w-0 truncate font-mono text-[13.5px] text-current hover:underline"
            title={item.path}
          >
            {fileName}
          </span>
          <DiffStat added={added} deleted={deleted} />
          {hasDetail && (
            <span className="shrink-0 text-[10px] text-text-tertiary">
              <ChevronGlyph open={open} />
            </span>
          )}
        </button>
      </div>

      {open && hasDetail && (
        <FileChangeDetail item={item} added={added} deleted={deleted} />
      )}
    </div>
  );
};

export default FileChangeToolCard;
