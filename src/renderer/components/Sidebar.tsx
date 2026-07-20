import React from 'react';
import type { Conversation, Project } from '../../shared/types';
import {
  IconSearch,
  IconPanels,
  IconChat,
  IconGear,
} from './icons';
import ProjectSwitcher from './ProjectSwitcher';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onNewGlobalConversation: () => void;
  onNewProjectConversation: (projectPath: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onCollapseSidebar: () => void;
  isMacOS: boolean;
  isFullscreen: boolean;

  projects: Project[];
  onAddProject: () => void;
  onRemoveProject: (path: string) => void;
  onOpenSearch: () => void;
  activeView?: 'chat' | 'settings';
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onNewGlobalConversation,
  onNewProjectConversation,
  onDeleteConversation,
  onRenameConversation,
  onCollapseSidebar,
  isMacOS,
  isFullscreen,
  projects,
  onAddProject,
  onRemoveProject,
  onOpenSearch,
  activeView,
  onOpenSettings,
}) => {
  const reserveTrafficLights = isMacOS && !isFullscreen;

  const projectGroups = React.useMemo(() => {
    const pg: Record<string, Conversation[]> = { 'unsorted': [] };
    conversations.forEach(conv => {
      const path = conv.project_path || 'unsorted';
      if (!pg[path]) pg[path] = [];
      pg[path].push(conv);
    });
    return pg;
  }, [conversations]);

  return (
    <aside className="sidebar-frame w-full shrink-0 flex flex-row min-h-0 h-full select-none overflow-hidden p-2">
      <div className="flex-1 sidebar-surface flex flex-col min-w-0 h-full overflow-hidden rounded-[14px] border border-hairline">
        {                                         }
        <div className="shrink-0 h-11 px-3 flex items-center gap-1.5 [-webkit-app-region:drag]">
          {                                                                  }
          {reserveTrafficLights && <div className="w-[72px] shrink-0" />}

          {                      }
          <button
            type="button"
            className="flex items-center gap-1.5 flex-1 py-1 px-2 rounded-[7px] bg-bg-chip text-text-secondary hover:bg-bg-hover transition-colors duration-150 text-left text-[13px] cursor-pointer min-w-0 select-none h-7 [-webkit-app-region:no-drag]"
            onClick={onOpenSearch}
          >
            <IconSearch size={13} className="text-text-secondary shrink-0" />
            <span className="flex-1 select-none text-text-tertiary whitespace-nowrap truncate min-w-0">搜索</span>
            <kbd className="text-[10px] text-text-tertiary font-mono px-1 py-0.5 rounded border border-hairline shrink-0 hidden xs:inline-block">
              {isMacOS ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>

          {                             }
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-bg-hover text-text-secondary transition-colors duration-150 shrink-0 cursor-pointer [-webkit-app-region:no-drag]"
            title="收起侧栏"
            onClick={onCollapseSidebar}
          >
            <IconPanels size={18} />
          </button>
        </div>

        {                               }
        <div className="shrink-0 pt-2 px-2 pb-1">
          <button
            type="button"
            className="flex items-center gap-2 w-full py-1.5 px-2 border-0 rounded-[7px] text-[13.5px] bg-transparent hover:bg-bg-hover transition-colors duration-150 text-text-primary cursor-pointer shrink-0 group"
            onClick={onNewConversation}
          >
            <IconChat size={15} className="text-text-secondary shrink-0" />
            <span className="text-[13.5px]">开启新对话</span>
          </button>
        </div>

        {                                     }
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="sidebar-scroll flex-1 overflow-y-auto px-2 pb-2 my-1">
            <ProjectSwitcher
              projects={projects}
              onAddProject={onAddProject}
              onRemoveProject={onRemoveProject}
              conversations={projectGroups}
              activeConversationId={activeConversationId}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
              onRenameConversation={onRenameConversation}
              onNewGlobalConversation={onNewGlobalConversation}
              onNewProjectConversation={onNewProjectConversation}
            />
          </div>
        </div>

        {                            }
        <div className="shrink-0 p-2 flex flex-col gap-0.5">
          <button
            type="button"
            className={`flex items-center gap-2.5 w-full py-1.5 px-2 rounded-[7px] text-[13.5px] transition-colors duration-150 text-left cursor-pointer ${
              activeView === 'settings'
                ? 'bg-accent-bg text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
            onClick={onOpenSettings}
          >
            <IconGear size={15} className={activeView === 'settings' ? 'text-accent' : 'text-text-secondary'} />
            <span>系统设置</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
