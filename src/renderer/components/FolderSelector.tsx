import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Project, ProjectCreateInput } from '../../shared/types';
import { IconFolderSoft, IconFolderOpen, IconChevronDown, IconSearch, IconCheck, IconPlus, IconChevronRight, IconFolderPlus } from './icons';

interface FolderSelectorProps {
  projects: Project[];
  activeProject: string | null;
  onSelectProject: (path: string | null) => void;
  onAddExistingProject: () => Promise<Project | null>;
  onCreateProject: (input: ProjectCreateInput) => Promise<Project | null>;
  onPickProjectParent: () => Promise<string | null>;
  /**
   * Visual variants for the trigger button:
   *   - 'chip'   : rounded pill (default, used in the input footer / toolbar)
   *   - 'inline' : inline text style "in [project] ▾", used as a semantic label below the welcome title
   */
  variant?: 'chip' | 'inline';
  /** Direction of the dropdown. Defaults to down; the welcome input uses up to avoid the viewport edge. */
  placement?: 'top' | 'bottom';
}

const IconFolderX: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = 'shrink-0 text-text-tertiary' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v2" />
    <line x1="13" y1="17" x2="19" y2="11" />
    <line x1="19" y1="17" x2="13" y2="11" />
  </svg>
);

function getErrorMessage(err: unknown): string {
  const fallback = 'Could not create the project. Check the project name and location.';
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
  return raw.replace(/^Error invoking remote method '[^']+': Error: /, '') || fallback;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onAddExistingProject,
  onCreateProject,
  onPickProjectParent,
  variant = 'chip',
  placement = 'bottom',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPickingParent, setIsPickingParent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingExisting, setIsAddingExisting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentProjectName = useMemo(() => {
    if (!activeProject) return 'No project';
    const found = projects.find((p) => p.path === activeProject);
    if (found) return found.name;
    return 'No project';
  }, [activeProject, projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(query) || p.path.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
      setShowSubmenu(false);
    }
  }, [isOpen]);

  const handleSelect = (path: string | null) => {
    onSelectProject(path);
    setIsOpen(false);
  };

  const handleAddExistingProject = async () => {
    if (isAddingExisting) return;
    setIsAddingExisting(true);
    setIsOpen(false);
    setShowSubmenu(false);
    try {
      const project = await onAddExistingProject();
      if (project) onSelectProject(project.path);
    } finally {
      setIsAddingExisting(false);
    }
  };

  const handleOpenCreateProject = () => {
    setIsOpen(false);
    setShowSubmenu(false);
    setProjectName('');
    setParentPath('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handlePickParent = async () => {
    if (isPickingParent) return;
    setIsPickingParent(true);
    try {
      const selectedPath = await onPickProjectParent();
      if (selectedPath) {
        setParentPath(selectedPath);
        setCreateError(null);
      }
    } finally {
      setIsPickingParent(false);
    }
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = projectName.trim();
    const nextParentPath = parentPath.trim();
    if (!nextName) {
      setCreateError('Enter a project name');
      return;
    }
    if (!nextParentPath) {
      setCreateError('Choose a project location');
      return;
    }
    if (/[\\/]/.test(nextName) || nextName === '.' || nextName === '..') {
      setCreateError('The project name cannot contain path separators or special directory names');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const project = await onCreateProject({ parentPath: nextParentPath, name: nextName });
      if (!project) {
        setCreateError('Could not create the project. Check the project name and location.');
        return;
      }
      onSelectProject(project.path);
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  };

  const menuPositionClass = placement === 'top'
    ? 'absolute left-0 bottom-full z-50 mb-2 origin-bottom-left'
    : 'absolute left-0 top-full z-50 mt-1 origin-top-left';

  return (
    <div className={variant === 'inline' ? 'relative inline-flex' : 'relative shrink-0'} ref={containerRef}>
      {variant === 'inline' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-md text-[14px] text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer border-none bg-transparent select-none group"
        >
          {activeProject ? (
            <>
              <IconFolderSoft size={16} className="text-text-secondary group-hover:text-text-primary shrink-0 transition-colors" />
              <span className="font-medium text-text-secondary group-hover:text-text-primary transition-colors max-w-[100px] xs:max-w-[150px] sm:max-w-[200px] truncate ml-[2px]">
                {currentProjectName}
              </span>
            </>
          ) : (
            <span className="text-text-tertiary group-hover:text-text-secondary transition-colors">
              No project
            </span>
          )}
          <IconChevronDown
            size={11}
            className={`transition-transform duration-200 opacity-60 shrink-0 ${isOpen ? 'rotate-180 text-accent opacity-100' : ''}`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 h-[28px] rounded-[8px] text-[13px] bg-bg-chip hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all font-medium cursor-pointer border-0 select-none"
        >
          <IconFolderSoft size={15} className="text-text-secondary shrink-0" />
          <span className="max-w-[150px] truncate leading-normal">
            {currentProjectName}
          </span>
          <IconChevronDown
            size={12}
            className={`transition-transform duration-200 opacity-60 shrink-0 ${isOpen ? 'rotate-180 text-accent' : ''}`}
          />
        </button>
      )}

      {isOpen && (
          <div
            data-testid="folder-selector-menu"
            className={`${menuPositionClass} min-w-[240px] max-w-[320px] bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-visible py-1 animate-[menu-in_150ms_ease-out]`}
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-hairline">
              <IconSearch size={14} className="text-text-tertiary shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects"
                className="w-full bg-transparent text-[13px] text-text-primary outline-none border-none placeholder:text-text-tertiary"
              />
            </div>

            {/* Project list */}
            <div className="max-h-[220px] overflow-y-auto p-1 custom-scrollbar">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((p) => {
                  const isSelected = p.path === activeProject;
                  return (
                    <button
                      key={p.path}
                      type="button"
                      onMouseEnter={() => setShowSubmenu(false)}
                      onClick={() => handleSelect(p.path)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[7px] text-left text-[13px] transition-colors border-none bg-transparent cursor-pointer ${
                        isSelected
                          ? 'text-accent bg-accent-bg font-medium'
                          : 'text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected ? (
                          <IconFolderOpen size={15} className="text-accent shrink-0" />
                        ) : (
                          <IconFolderSoft size={15} className="text-text-tertiary shrink-0" />
                        )}
                        <span className="truncate" title={p.path}>
                          {p.name}
                        </span>
                      </div>
                      {isSelected && <IconCheck size={14} className="text-accent shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-3.5 py-3 text-center text-text-tertiary text-[12px] select-none">
                  No matching projects
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="border-t border-hairline my-1" />

            {/* Submenu Trigger: Add new project (Hover Side Flyout) */}
            <div
              className="relative px-1"
              onMouseEnter={() => setShowSubmenu(true)}
              onMouseLeave={() => setShowSubmenu(false)}
            >
              <button
                type="button"
                onClick={() => setShowSubmenu((current) => !current)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[7px] text-left text-[13px] cursor-pointer border-none bg-transparent transition-colors ${
                  showSubmenu
                    ? 'text-accent bg-accent-bg'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconFolderPlus size={15} className={showSubmenu ? 'text-accent' : 'text-text-tertiary'} />
                <span>Add project</span>
                </div>
                <IconChevronRight
                  size={12}
                  className={`text-text-tertiary shrink-0 transition-colors ${showSubmenu ? 'text-accent' : ''}`}
                />
              </button>

              {showSubmenu && (
                <div
                  className="absolute left-full top-[-4px] ml-0.5 w-[180px] overflow-hidden rounded-[12px] border border-hairline bg-bg-main p-1.5 shadow-floating z-50 animate-[menu-in_150ms_ease-out]"
                >
                  <button
                    type="button"
                    onClick={handleOpenCreateProject}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-left text-[12.5px] text-text-primary hover:bg-bg-hover cursor-pointer border-none bg-transparent transition-colors"
                  >
                    <IconPlus size={13} className="text-text-tertiary shrink-0" />
                <span>Create blank project</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddExistingProject}
                    disabled={isAddingExisting}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-left text-[12.5px] text-text-primary hover:bg-bg-hover cursor-pointer border-none bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconFolderSoft size={13} className="text-text-tertiary shrink-0" />
                <span>Use existing folder</span>
                  </button>
                </div>
              )}
            </div>
            <div className="px-1 pt-0.5 pb-1">
              <button
                type="button"
                onMouseEnter={() => setShowSubmenu(false)}
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[7px] text-left text-[13px] transition-colors border-none bg-transparent cursor-pointer ${
                  activeProject === null
                    ? 'text-accent bg-accent-bg font-medium'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconFolderX size={15} className={activeProject === null ? 'text-accent' : 'text-text-tertiary'} />
                <span>No project</span>
                </div>
                {activeProject === null && <IconCheck size={14} className="text-accent shrink-0" />}
              </button>
            </div>
          </div>
      )}

      {isCreateOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            onMouseDown={() => {
              if (!isCreating) setIsCreateOpen(false);
            }}
          >
            <form
              onSubmit={handleCreateProject}
              className="w-full max-w-[460px] overflow-hidden rounded-[14px] border border-hairline bg-bg-main shadow-floating animate-[menu-in_150ms_ease-out]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="border-b border-hairline px-5 py-4">
                <h2 id="create-project-title" className="text-[15px] font-medium text-text-primary">
                New project
                </h2>
              </div>

              <div className="flex flex-col gap-4 px-5 py-4">
                <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Project name</span>
                  <input
                    value={projectName}
                    onChange={(event) => {
                      setProjectName(event.target.value);
                      if (createError) setCreateError(null);
                    }}
                    className="h-9 rounded-[8px] border border-hairline bg-bg-block px-3 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent/45 focus:ring-[3px] focus:ring-accent-bg"
                    placeholder="my-project"
                    autoFocus
                    disabled={isCreating}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Project location</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={parentPath}
                      onChange={(event) => {
                        setParentPath(event.target.value);
                        if (createError) setCreateError(null);
                      }}
                      className="h-9 min-w-0 flex-1 rounded-[8px] border border-hairline bg-bg-block px-3 font-mono text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent/45 focus:ring-[3px] focus:ring-accent-bg"
                      placeholder="/Users/name/Code"
                      disabled={isCreating}
                    />
                    <button
                      type="button"
                      onClick={handlePickParent}
                      disabled={isCreating || isPickingParent}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-hairline bg-transparent px-3 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IconFolderSoft size={14} className="shrink-0" />
                      <span>{isPickingParent ? 'Selecting…' : 'Choose'}</span>
                    </button>
                  </div>
                </label>

                {createError && (
                  <div className="rounded-[8px] border border-hairline bg-diff-del-bg px-3 py-2 text-[12px] font-medium text-diff-del">
                    {createError}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="h-8 rounded-[8px] border border-hairline bg-transparent px-3.5 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border-none bg-accent px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconPlus size={14} className="shrink-0" />
                  <span>{isCreating ? 'Creating…' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
      )}
    </div>
  );
};

export default FolderSelector;
