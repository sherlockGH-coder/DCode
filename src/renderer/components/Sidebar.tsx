import React from 'react';
import type { Conversation, Project } from '../../shared/types';
import {
  IconSearch,
  IconPanels,
  IconChatPlus,
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
    <aside className="sidebar-frame shrink-0 flex flex-row min-h-0 h-full select-none overflow-hidden p-2">
      <div className="flex-1 sidebar-surface flex flex-col min-w-0 h-full overflow-hidden rounded-[14px] border border-hairline">
        <div className="shrink-0 h-11 px-3 flex items-center gap-1.5 [-webkit-app-region:drag]">
          {reserveTrafficLights && <div className="w-[72px] shrink-0" />}

          <button
            type="button"
            className="flex items-center gap-1.5 flex-1 py-1 px-2 rounded-[7px] bg-black/[0.04] text-[#2C3038] hover:bg-black/[0.07] border border-black/[0.06] transition-colors duration-150 text-left text-[13px] cursor-pointer min-w-0 select-none h-7 [-webkit-app-region:no-drag] dark:bg-white/[0.08] dark:border-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.12]"
            onClick={onOpenSearch}
          >
            <IconSearch size={13} className="text-[#646873] dark:text-zinc-400 shrink-0" />
            <span className="flex-1 select-none text-[#747882] dark:text-zinc-400 whitespace-nowrap truncate min-w-0 font-medium">Search</span>
            <kbd className="text-[10px] text-[#747882] dark:text-zinc-400 font-mono px-1 py-0.5 rounded border border-black/[0.1] dark:border-white/[0.1] shrink-0 hidden xs:inline-block">
              {isMacOS ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>

          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[#4B5058] dark:text-zinc-300 transition-colors duration-150 shrink-0 cursor-pointer [-webkit-app-region:no-drag]"
            title="Collapse sidebar"
            onClick={onCollapseSidebar}
          >
            <IconPanels size={18} />
          </button>
        </div>

        <div className="shrink-0 pt-2 px-2 pb-1.5">
          <button
            type="button"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-[10px] border border-black/[0.08] bg-white/80 text-[13.5px] font-semibold text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all duration-150 hover:bg-white hover:border-black/[0.14] hover:shadow-[0_2px_5px_rgba(0,0,0,0.06)] active:scale-[0.99] cursor-pointer dark:border-white/[0.1] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            onClick={onNewConversation}
          >
            <IconChatPlus size={16} className="text-[#1C1C1E] dark:text-white shrink-0" />
            <span>New conversation</span>
          </button>
        </div>

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

        <div className="shrink-0 p-2 flex flex-col gap-0.5 border-t border-black/[0.06] dark:border-white/[0.06]">
          <button
            type="button"
            className={`flex items-center gap-2.5 w-full py-1.5 px-2 rounded-[7px] text-[13.5px] font-medium transition-colors duration-150 text-left cursor-pointer ${
              activeView === 'settings'
                ? 'bg-accent-bg text-accent font-semibold'
                : 'text-[#2C3038] dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-[#111827] dark:hover:text-white'
            }`}
            onClick={onOpenSettings}
          >
            <IconGear size={15} className={activeView === 'settings' ? 'text-accent' : 'text-[#4B5058] dark:text-zinc-300'} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
