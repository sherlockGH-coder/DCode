import React from 'react';
import { IconPanelsRight, IconSidebarTerminal } from '../components/icons';

interface WorkspaceDockButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

const WORKSPACE_DOCK_ICON_SIZE = 15;
const WORKSPACE_DOCK_CLASS = 'inline-flex h-full shrink-0 items-center gap-1 [-webkit-app-region:no-drag]';
const WORKSPACE_DOCK_BUTTON_CLASS = 'inline-flex h-7 w-7 items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary';
const WORKSPACE_DOCK_ACTIVE_CLASS = 'text-accent hover:text-accent';

const WorkspaceDockButton: React.FC<WorkspaceDockButtonProps> = ({
  active,
  label,
  onClick,
  children,
}) => (
  <button
    type="button"
    className={`${WORKSPACE_DOCK_BUTTON_CLASS} ${active ? WORKSPACE_DOCK_ACTIVE_CLASS : ''}`}
    aria-label={label}
    aria-pressed={active}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
);

const WorkspaceDock: React.FC<{
  artifactPanelActive: boolean;
  terminalActive: boolean;
  onToggleRightPanel: () => void;
  onToggleBottomPanel: () => void;
}> = ({
  artifactPanelActive,
  terminalActive,
  onToggleRightPanel,
  onToggleBottomPanel,
}) => (
  <div className={WORKSPACE_DOCK_CLASS} aria-label="工作区切换">
    <WorkspaceDockButton
      active={artifactPanelActive}
      label={artifactPanelActive ? '隐藏产物面板' : '显示产物面板'}
      onClick={onToggleRightPanel}
    >
      <IconPanelsRight size={WORKSPACE_DOCK_ICON_SIZE} />
    </WorkspaceDockButton>
    <WorkspaceDockButton
      active={terminalActive}
      label={terminalActive ? '隐藏终端' : '显示终端'}
      onClick={onToggleBottomPanel}
    >
      <IconSidebarTerminal size={WORKSPACE_DOCK_ICON_SIZE} />
    </WorkspaceDockButton>
  </div>
);

export default WorkspaceDock;
