import React from 'react';
import { IconBookOpen, IconChecklist, IconFile, IconFolder, IconGlobe, IconPlug, IconRobot, IconSearch, IconSidebarTerminal, IconWrench } from '../icons';

export type ToolIconType = 'file' | 'folder' | 'terminal' | 'search' | 'check' | 'globe' | 'book' | 'wrench' | 'agent' | 'mcp';

const ICON_MAP: Record<ToolIconType, React.FC<{ size?: number; className?: string }>> = {
  file: IconFile,
  folder: IconFolder,
  terminal: IconSidebarTerminal,
  search: IconSearch,
  check: IconChecklist,
  globe: IconGlobe,
  book: IconBookOpen,
  wrench: IconWrench,
  agent: IconRobot,
  mcp: IconPlug,
};

export const ToolDetailFrame: React.FC<{
  children: React.ReactNode;
  className?: string;
  testId?: string;
}> = ({ children, className = '', testId }) => (
  <div
    data-testid={testId}
    className={`overflow-hidden rounded-[10px] border border-hairline bg-bg-block ${className}`.trim()}
  >
    {children}
  </div>
);

export const IconPencil: React.FC<{ size?: number; className?: string }> = ({ size = 13, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 19 L10 18 L19 9 a2.83 2.83 0 0 0 -4 -4 L6 14 Z" />
    <path d="M13 7 L17 11" />
  </svg>
);

export const ChevronGlyph: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const ToolKindBadge: React.FC<{ iconType: ToolIconType }> = ({ iconType }) => {
  const Icon = ICON_MAP[iconType] ?? IconFile;

  return (
    <span
      data-testid="tool-item-kind-icon"
      data-tool-icon={iconType}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current"
    >
      <Icon size={14.5} className="text-current" />
    </span>
  );
};
