import React from 'react';
import { IconPanelsRight, IconSidebarTerminal } from '../components/icons';

interface WorkspaceDockButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

const WORKSPACE_DOCK_ICON_SIZE = 15;
const WORKSPACE_DOCK_CLASS = 'inline-flex h-full shrink-0 items-center gap-1 overflow-hidden transition-[width,opacity] duration-[0.24s] ease-[cubic-bezier(0.32,0.72,0,1)] [-webkit-app-region:no-drag]';
const WORKSPACE_DOCK_BUTTON_CLASS = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary';
const WORKSPACE_DOCK_ACTIVE_CLASS = 'text-accent hover:text-accent';
/* Two 28px icon buttons with 4px spacing. */
const WORKSPACE_DOCK_WIDTH_CLASS = 'w-[60px]';

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
  /** Collapse visually while staying mounted so the transition can complete. */
  hidden?: boolean;
  artifactPanelActive: boolean;
  terminalActive: boolean;
  onToggleRightPanel: () => void;
  onToggleBottomPanel: () => void;
}> = ({
  hidden = false,
  artifactPanelActive,
  terminalActive,
  onToggleRightPanel,
  onToggleBottomPanel,
}) => (
  <div
    className={`${WORKSPACE_DOCK_CLASS} ${hidden ? 'w-0 opacity-0 pointer-events-none' : `${WORKSPACE_DOCK_WIDTH_CLASS} opacity-100`}`}
    data-testid="workspace-dock"
    aria-label="Workspace panels"
    aria-hidden={hidden}
    inert={hidden ? true : undefined}
  >
    <WorkspaceDockButton
      active={artifactPanelActive}
      label={artifactPanelActive ? 'Hide artifact panel' : 'Show artifact panel'}
      onClick={onToggleRightPanel}
    >
      <IconPanelsRight size={WORKSPACE_DOCK_ICON_SIZE} />
    </WorkspaceDockButton>
    <WorkspaceDockButton
      active={terminalActive}
      label={terminalActive ? 'Hide terminal' : 'Show terminal'}
      onClick={onToggleBottomPanel}
    >
      <IconSidebarTerminal size={WORKSPACE_DOCK_ICON_SIZE} />
    </WorkspaceDockButton>
  </div>
);

export default WorkspaceDock;
