import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, Conversation } from '../../shared/types';
import {
  IconFolderOpen,
  IconProjectFolder,
  IconFolderPlus,
  IconDots,
  IconEdit,
  IconX,
  IconChevronDown,
  IconChevronRight,
} from './icons';
import { formatSlashCommandsForTitle } from '../utils/slashCommands';
import ConfirmDialog from './project-switcher/ConfirmDialog';
import {
  COLLAPSED_CONVERSATION_LIMIT,
  UNSORTED_CONVERSATION_LIST_ID,
  formatRelativeTime,
  getMenuPosition,
  type MenuPosition,
} from './project-switcher/utils';

interface ProjectSwitcherProps {
  projects: Project[];
  onAddProject: () => void;
  onRemoveProject: (path: string) => void;
  conversations: Record<string, Conversation[]>;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onNewGlobalConversation: () => void;
  onNewProjectConversation: (projectPath: string) => void;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  onAddProject,
  onRemoveProject,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onNewGlobalConversation,
  onNewProjectConversation,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedConversationLists, setExpandedConversationLists] = useState<Set<string>>(new Set());

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [confirmDelete, setConfirmDelete] = useState<Conversation | null>(null);
  const [confirmRemoveProject, setConfirmRemoveProject] = useState<Project | null>(null);

  const [openProjectMenuPath, setOpenProjectMenuPath] = useState<string | null>(null);
  const [projectMenuPosition, setProjectMenuPosition] = useState<MenuPosition | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const trigger = menuTriggerRefs.current[openMenuId];
      if (menuRef.current?.contains(target) || trigger?.contains(target)) return;

      setOpenMenuId(null);
      setMenuPosition(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (!openProjectMenuPath) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const trigger = projectMenuTriggerRefs.current[openProjectMenuPath];
      if (projectMenuRef.current?.contains(target) || trigger?.contains(target)) return;

      setOpenProjectMenuPath(null);
      setProjectMenuPosition(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openProjectMenuPath]);

  const updateMenuPosition = useCallback(() => {
    if (!openMenuId) return;

    const trigger = menuTriggerRefs.current[openMenuId];
    if (!trigger) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }

    setMenuPosition(getMenuPosition(trigger, menuRef.current));
  }, [openMenuId]);

  useLayoutEffect(() => {
    if (!openMenuId) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [openMenuId, updateMenuPosition]);

  const updateProjectMenuPosition = useCallback(() => {
    if (!openProjectMenuPath) return;

    const trigger = projectMenuTriggerRefs.current[openProjectMenuPath];
    if (!trigger) {
      setOpenProjectMenuPath(null);
      setProjectMenuPosition(null);
      return;
    }

    setProjectMenuPosition(getMenuPosition(trigger, projectMenuRef.current));
  }, [openProjectMenuPath]);

  useLayoutEffect(() => {
    if (!openProjectMenuPath) return;

    updateProjectMenuPosition();
    window.addEventListener('resize', updateProjectMenuPosition);
    window.addEventListener('scroll', updateProjectMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateProjectMenuPosition);
      window.removeEventListener('scroll', updateProjectMenuPosition, true);
    };
  }, [openProjectMenuPath, updateProjectMenuPosition]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleConversationList = useCallback((listId: string) => {
    setExpandedConversationLists(prev => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  }, []);

  const getVisibleConversations = useCallback((listId: string, convs: Conversation[]) => {
    if (expandedConversationLists.has(listId) || convs.length <= COLLAPSED_CONVERSATION_LIMIT) {
      return convs;
    }

    const visibleConvs = convs.slice(0, COLLAPSED_CONVERSATION_LIMIT);
    const activeConv = convs.find((conv) => conv.id === activeConversationId);
    const activeAlreadyVisible = visibleConvs.some((conv) => conv.id === activeConversationId);

    return activeConv && !activeAlreadyVisible
      ? [...visibleConvs, activeConv]
      : visibleConvs;
  }, [activeConversationId, expandedConversationLists]);
  const handleStartRename = useCallback((conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
    setOpenMenuId(null);
    setMenuPosition(null);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRenameConversation]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDeleteClick = useCallback((conv: Conversation) => {
    setOpenMenuId(null);
    setMenuPosition(null);
    setConfirmDelete(conv);
  }, []);

  const handleMenuToggle = useCallback((conversationId: string, trigger: HTMLButtonElement) => {
    if (openMenuId === conversationId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }

    setMenuPosition(getMenuPosition(trigger, menuRef.current));
    setOpenMenuId(conversationId);
  }, [openMenuId]);

  const handleProjectMenuToggle = useCallback((projectPath: string, trigger: HTMLButtonElement) => {
    if (openProjectMenuPath === projectPath) {
      setOpenProjectMenuPath(null);
      setProjectMenuPosition(null);
      return;
    }

    setProjectMenuPosition(getMenuPosition(trigger, projectMenuRef.current));
    setOpenProjectMenuPath(projectPath);
  }, [openProjectMenuPath]);

  const renderProjectMenu = (project: Project) => {
    if (openProjectMenuPath !== project.path || !projectMenuPosition) return null;

    return createPortal(
      <div
        ref={projectMenuRef}
        role="menu"
        aria-label="项目操作"
        className="fixed z-[1000] min-w-[140px] py-1 bg-bg-main rounded-[14px] border border-hairline shadow-floating"
        style={{ left: projectMenuPosition.left, top: projectMenuPosition.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13.5px] text-text-primary hover:bg-bg-hover cursor-pointer border-none bg-transparent transition-colors"
          onClick={() => {
            setOpenProjectMenuPath(null);
            setProjectMenuPosition(null);
            setConfirmRemoveProject(project);
          }}
        >
          <IconX size={13} className="text-text-tertiary" />
          移除项目
        </button>
      </div>,
      document.body,
    );
  };

  const handleConfirmDelete = useCallback(() => {
    if (confirmDelete) {
      onDeleteConversation(confirmDelete.id);
      setConfirmDelete(null);
    }
  }, [confirmDelete, onDeleteConversation]);

  const handleConfirmRemoveProject = useCallback(() => {
    if (confirmRemoveProject) {
      onRemoveProject(confirmRemoveProject.path);
      setConfirmRemoveProject(null);
    }
  }, [confirmRemoveProject, onRemoveProject]);

  const renderMenu = (conv: Conversation) => {
    if (openMenuId !== conv.id || !menuPosition) return null;

    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label="会话操作"
        className="fixed z-[1000] min-w-[140px] py-1 bg-bg-main rounded-[14px] border border-hairline shadow-floating"
        style={{ left: menuPosition.left, top: menuPosition.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13.5px] text-text-primary hover:bg-bg-hover cursor-pointer border-none bg-transparent transition-colors"
          onClick={() => handleStartRename(conv)}
        >
          <IconEdit size={13} className="text-text-tertiary" />
          重命名
        </button>
        <button
          type="button"
          role="menuitem"
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13.5px] text-text-primary hover:bg-bg-hover cursor-pointer border-none bg-transparent transition-colors"
          onClick={() => handleDeleteClick(conv)}
        >
          <IconX size={13} className="text-text-tertiary" />
          删除对话
        </button>
      </div>,
      document.body,
    );
  };

  const renderConversationItem = (conv: Conversation, nested = false) => {
    const isActive = conv.id === activeConversationId;
    const isRenaming = renamingId === conv.id;
    const displayTitle = formatSlashCommandsForTitle(conv.title);

    const relativeTime = formatRelativeTime(conv.updated_at);

    return (
      <div
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-1.5 w-full py-1.5 pr-2.5 rounded-[7px] text-left cursor-pointer transition-colors duration-150 relative text-[13.5px] ${
          nested ? 'pl-[36px]' : 'pl-2.5'
        } ${
          isActive
            ? 'bg-bg-hover text-text-primary font-medium'
            : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
        onClick={() => !isRenaming && onSelectConversation(conv.id)}
        onKeyDown={(e) => {
          if (!isRenaming && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectConversation(conv.id);
          }
        }}
      >
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleConfirmRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRename();
              if (e.key === 'Escape') handleCancelRename();
            }}
            className="flex-1 min-w-0 text-[13.5px] bg-bg-main border border-accent/45 rounded-[5px] px-1.5 py-0.5 outline-none text-text-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="flex-1 min-w-0 text-[13.5px] overflow-hidden text-ellipsis whitespace-nowrap pr-1.5">
              {displayTitle}
            </span>

            {!isRenaming && (
              <div className="relative shrink-0 flex items-center justify-end h-5 w-[24px]">
                {                               }
                <button
                  ref={(node) => {
                    menuTriggerRefs.current[conv.id] = node;
                  }}
                  type="button"
                  className="absolute right-0 opacity-0 group-hover:opacity-100 border-none bg-transparent text-text-tertiary px-1.5 py-0.5 rounded-md hover:text-text-primary hover:bg-bg-hover transition-all cursor-pointer z-10 flex items-center justify-center"
                  title="更多操作"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuToggle(conv.id, e.currentTarget);
                  }}
                >
                  <IconDots size={14} />
                </button>
                {renderMenu(conv)}

                {                    }
                <div className="group-hover:opacity-0 transition-opacity duration-150 flex items-center justify-end">
                  {relativeTime && (
                    <span className="text-[11.5px] text-text-tertiary whitespace-nowrap font-normal">
                      {relativeTime}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderConversationList = (listId: string, convs: Conversation[], nested = true) => {
    const isListExpanded = expandedConversationLists.has(listId);
    const visibleConvs = getVisibleConversations(listId, convs);
    const hiddenCount = convs.length - visibleConvs.length;
    const canToggle = convs.length > COLLAPSED_CONVERSATION_LIMIT;

    return (
      <ul className={`list-none m-0 p-0 ${nested ? 'mt-0.5 space-y-1' : 'space-y-1'}`}>
        {visibleConvs.map((conv) => (
          <li key={conv.id} className="relative">
            {renderConversationItem(conv, nested)}
          </li>
        ))}
        {canToggle && (
          <li className="relative">
            <button
              type="button"
              className={`group flex items-center gap-1.5 w-full py-1.5 pr-2.5 border-none rounded-md bg-transparent text-[13px] text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition-all cursor-pointer ${
                nested ? 'pl-[22px]' : 'pl-2.5'
              }`}
              onClick={() => toggleConversationList(listId)}
              title={isListExpanded ? '折叠显示' : '展开显示'}
            >
              <span className="shrink-0 transition-colors group-hover:text-text-secondary">
                {isListExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
              </span>
              <span className="flex-1 min-w-0 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                {isListExpanded ? '折叠显示' : `展开显示${hiddenCount > 0 ? `（${hiddenCount}）` : ''}`}
              </span>
            </button>
          </li>
        )}
      </ul>
    );
  };

  const unarchivedChats = conversations['unsorted'] || [];

  return (
    <section className="mt-2.5 flex flex-col gap-4.5">
      {                      }
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-2.5 py-0.5">
          <h2 className="text-[12px] font-normal text-text-tertiary">
            项目
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-all cursor-pointer"
            title="添加项目"
            onClick={onAddProject}
          >
            <IconFolderPlus size={16} />
          </button>
        </div>

        <ul className="list-none m-0 p-0 space-y-0.5">
          {projects.map((project) => {
            const isExpanded = expandedPaths.has(project.path);
            const projectChats = conversations[project.path] || [];

            return (
              <li key={project.path}>
                <div
                  role="button"
                  tabIndex={0}
                  className="group flex items-center gap-1.5 w-full py-1.5 px-2.5 rounded-[7px] bg-transparent text-[13.5px] cursor-pointer text-left transition-colors duration-150 relative text-text-primary hover:bg-bg-hover"
                  onClick={(e) => toggleExpand(project.path, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(project.path, e as any);
                    }
                  }}
                  title={project.path}
                >
                  <div className="shrink-0 rounded-md transition-all">
                    {isExpanded ? (
                      <IconFolderOpen size={16} className="text-text-secondary transition-colors" />
                    ) : (
                      <IconProjectFolder size={16} className="text-text-secondary transition-colors" />
                    )}
                  </div>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px]">
                    {project.name}
                  </span>

                  <button
                    ref={(node) => {
                      projectMenuTriggerRefs.current[project.path] = node;
                    }}
                    type="button"
                    className="shrink-0 opacity-0 group-hover:opacity-100 border-none bg-transparent text-text-tertiary cursor-pointer p-0.5 rounded transition-all hover:text-text-primary hover:bg-bg-hover"
                    title="更多操作"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectMenuToggle(project.path, e.currentTarget);
                    }}
                  >
                    <IconDots size={14} />
                  </button>

                  <button
                    type="button"
                    className="shrink-0 opacity-0 group-hover:opacity-100 border-none bg-transparent text-text-tertiary cursor-pointer p-0.5 rounded transition-all hover:text-text-primary hover:bg-bg-hover"
                    title="在此项目下新建对话"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewProjectConversation(project.path);
                    }}
                  >
                    <IconEdit size={14} />
                  </button>
                </div>

                {renderProjectMenu(project)}

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    isExpanded && projectChats.length > 0 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                  aria-hidden={!isExpanded || projectChats.length === 0}
                  inert={!isExpanded || projectChats.length === 0 ? true : undefined}
                >
                  <div className="min-h-0 overflow-hidden">
                    {projectChats.length > 0 && renderConversationList(project.path, projectChats)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {                                          }
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-2.5 py-0.5">
          <h2 className="text-[12px] font-normal text-text-tertiary">
            对话
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-all cursor-pointer"
            title="新建对话"
            onClick={onNewGlobalConversation}
          >
            <IconEdit size={14} />
          </button>
        </div>

        {unarchivedChats.length > 0 &&
          renderConversationList(UNSORTED_CONVERSATION_LIST_ID, unarchivedChats, false)}
      </div>

      {            }
      {confirmDelete &&
        createPortal(
          <ConfirmDialog
            title="删除对话"
            confirmLabel="删除"
            onCancel={() => setConfirmDelete(null)}
            onConfirm={handleConfirmDelete}
          >
            确认要删除对话 <span className="font-semibold text-text-primary">{confirmDelete.title}</span>？此操作不可撤销，所有消息将被永久删除。
          </ConfirmDialog>,
          document.body,
        )}

      {              }
      {confirmRemoveProject &&
        createPortal(
          <ConfirmDialog
            title="移除项目"
            confirmLabel="移除"
            onCancel={() => setConfirmRemoveProject(null)}
            onConfirm={handleConfirmRemoveProject}
          >
            确认要移除项目 <span className="font-semibold text-text-primary">{confirmRemoveProject.name}</span>？此操作不会删除项目文件，仅从列表中移除。
          </ConfirmDialog>,
          document.body,
        )}
    </section>
  );
};

export default ProjectSwitcher;
