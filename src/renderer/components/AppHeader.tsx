import React from 'react';
import {
  IconSidebarToggle,
  IconEdit,
  IconProjectFolder,
} from './icons';

interface AppHeaderProps {
  isMacOS: boolean;
  isFullscreen: boolean;
  sidebarCollapsed: boolean;
  chatTitle: string;
  /** 当前对话所属项目名（null 表示未归类对话） */
  projectName: string | null;
  onShowSidebar: () => void;
  onNewConversation: () => void;
  rightContent?: React.ReactNode;
}

interface HeaderToolButtonProps {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

const HEADER_ACTIONS_CLASS = 'inline-flex h-7 items-center gap-1.5';
const TOOL_BUTTON_BASE_CLASS = 'inline-flex h-7 w-7 items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary';
const TOOL_BUTTON_ACTIVE_CLASS = 'text-accent hover:text-accent';
const MAX_VISIBLE_TITLE_CHARS = 48;
const TITLE_GROUP_CLASS = 'flex shrink min-w-0 max-w-[min(64vw,760px)] items-center gap-2 [-webkit-app-region:drag]';
const PROJECT_ICON_CLASS = 'shrink-0 text-text-tertiary';
const PROJECT_NAME_CLASS = 'shrink-0 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-normal leading-tight text-text-tertiary';
const TITLE_SEPARATOR_CLASS = 'shrink-0 text-[14px] font-normal leading-tight text-text-tertiary';
const CHAT_TITLE_CLASS = 'm-0 min-w-0 max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-medium leading-tight text-text-primary';

function truncateTitle(title: string, maxLength: number): string {
  const normalizedTitle = title.trim();
  const chars = Array.from(normalizedTitle);

  if (chars.length <= maxLength) return normalizedTitle;

  return `${chars.slice(0, maxLength).join('').trimEnd()}...`;
}

const HeaderToolButton: React.FC<HeaderToolButtonProps> = ({
  active,
  label,
  onClick,
  children,
}) => {
  const isActive = active === true;
  const isToggle = active !== undefined;

  return (
    <button
      type="button"
      className={`${TOOL_BUTTON_BASE_CLASS} ${isActive ? TOOL_BUTTON_ACTIVE_CLASS : ''}`}
      aria-label={label}
      aria-pressed={isToggle ? isActive : undefined}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const AppHeader: React.FC<AppHeaderProps> = ({
  isMacOS,
  isFullscreen,
  sidebarCollapsed,
  chatTitle,
  projectName,
  onShowSidebar,
  onNewConversation,
  rightContent,
}) => {
  const normalizedTitle = chatTitle.trim();
  const displayTitle = truncateTitle(normalizedTitle, MAX_VISIBLE_TITLE_CHARS);
  const fullTitle = projectName && normalizedTitle
    ? `${projectName} / ${normalizedTitle}`
    : normalizedTitle;

  return (
    <header
      className="app-header shrink-0 flex h-11 items-center gap-2.5 bg-transparent pl-2.5 pr-3.5 z-30 [-webkit-app-region:drag]"
      style={isMacOS && sidebarCollapsed && !isFullscreen ? { paddingLeft: 78 } : undefined}
    >
      {sidebarCollapsed ? (
        <div className={`${HEADER_ACTIONS_CLASS} shrink-0 [-webkit-app-region:no-drag]`}>
          <HeaderToolButton label="显示侧栏" onClick={onShowSidebar}>
            <IconSidebarToggle size={16} />
          </HeaderToolButton>
          <HeaderToolButton label="新对话" onClick={onNewConversation}>
            <IconEdit size={16} />
          </HeaderToolButton>
        </div>
      ) : null}
      {displayTitle ? (
        <div className={TITLE_GROUP_CLASS} title={fullTitle}>
          {projectName ? (
            <>
              <IconProjectFolder size={18} className={PROJECT_ICON_CLASS} />
              <span className={PROJECT_NAME_CLASS}>{projectName}</span>
              <span className={TITLE_SEPARATOR_CLASS} aria-hidden>/</span>
            </>
          ) : null}
          <h1 className={CHAT_TITLE_CLASS}>{displayTitle}</h1>
        </div>
      ) : null}
      <div className="flex-1 min-w-0 self-stretch [-webkit-app-region:drag]" aria-hidden />
      {rightContent ? (
        <div className="flex h-full shrink-0 items-center [-webkit-app-region:no-drag]">
          {rightContent}
        </div>
      ) : null}
    </header>
  );
};

export default AppHeader;
