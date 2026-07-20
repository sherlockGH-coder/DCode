import React, { useMemo, useState } from 'react';
import type { ToolItem } from '../../shared/types';
import { IconBookOpen, IconChevronDown, IconGlobe, IconSearch, IconSidebarTerminal } from './icons';

interface ExplorationGroupProps {
  items: ToolItem[];
  summary: string;
  defaultCollapsed?: boolean;
  hideIcon?: boolean;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function isSimplePattern(pattern: string): boolean {
  return pattern.length <= 36 && /^[\w\s./:-]+$/.test(pattern);
}

function describeExplorationItem(item: ToolItem): string {
  switch (item.kind) {
    case 'read':
      return `已读取 ${basename(item.path)}`;
    case 'list_directory':
      return `已列出 ${basename(item.path)}`;
    case 'glob': {
      const cleanPattern = item.pattern.replace(/\/?\*+.*$/, '');
      const target = basename(cleanPattern) || basename(item.pattern);
      return target ? `已列出 ${target}` : '已列出文件';
    }
    case 'grep':
      return isSimplePattern(item.pattern) ? `已搜索 ${item.pattern}` : '已搜索代码';
    case 'web_search':
      return `已搜索网页 ${item.query}`;
    case 'web_fetch':
      return `已抓取 ${item.title || item.url}`;
    default:
      return '已探索';
  }
}

function getGroupIcon(items: ToolItem[]): { key: string; Icon: React.FC<{ size?: number; className?: string }> } {
  if (items.every((item) => item.kind === 'read')) {
    return { key: 'book', Icon: IconBookOpen };
  }
  if (items.some((item) => item.kind === 'grep' || item.kind === 'glob' || item.kind === 'list_directory')) {
    return { key: 'search', Icon: IconSearch };
  }
  if (items.some((item) => item.kind === 'web_search' || item.kind === 'web_fetch')) {
    return { key: 'globe', Icon: IconGlobe };
  }
  return { key: 'terminal', Icon: IconSidebarTerminal };
}

const ExplorationGroup: React.FC<ExplorationGroupProps> = ({ items, summary, defaultCollapsed, hideIcon = false }) => {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const { key: iconKey, Icon } = useMemo(() => getGroupIcon(items), [items]);

  return (
    <div className="tool-item-shell w-full overflow-hidden">
      <button
        type="button"
        data-testid="exploration-summary"
        data-tool-icon={iconKey}
        onClick={() => setExpanded((value) => !value)}
        className="tool-item-row-surface group/exploration-row flex min-h-6 w-fit max-w-full cursor-pointer items-center gap-[9px] border-0 bg-transparent py-1 text-left text-text-secondary transition-colors duration-150 hover:text-text-primary"
        aria-expanded={expanded}
      >
        {!hideIcon && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-75">
            <Icon size={15} className="text-current" />
          </span>
        )}
        <span className="min-w-0 truncate text-[13.5px] text-current">{summary}</span>
        <IconChevronDown
          size={12}
          className={`shrink-0 text-current transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-1.5 pl-[25px]">
          {items.map((item) => (
            <div
              key={item.id}
              data-testid="exploration-detail"
              className="min-w-0 truncate text-[13.5px] leading-5 text-text-tertiary"
              title={describeExplorationItem(item)}
            >
              {describeExplorationItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExplorationGroup;
