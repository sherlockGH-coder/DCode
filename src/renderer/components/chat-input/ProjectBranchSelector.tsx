import React from 'react';
import { IconProjectFolder, IconBranch } from '../icons';

const ProjectBranchSelector: React.FC<{
  projectSelector?: React.ReactNode;
  activeProject?: string | null;
  gitInfo: { currentBranch: string; branches: string[] } | null;
  branchMenuRef: React.RefObject<HTMLDivElement | null>;
  isBranchMenuOpen: boolean;
  hasMultipleBranches: boolean | null;
  isLoading: boolean;
  onBranchMenuOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onCheckoutBranch: (branch: string) => void;
}> = ({
  projectSelector,
  activeProject,
  gitInfo,
  branchMenuRef,
  isBranchMenuOpen,
  hasMultipleBranches,
  isLoading,
  onBranchMenuOpenChange,
  onCheckoutBranch,
}) => (
  <div
    data-testid="chat-input-project-branch-slot"
    className="flex min-w-0 shrink items-center gap-1 text-text-tertiary overflow-visible"
  >
    {projectSelector || (activeProject && (
      <div className="inline-flex min-w-0 shrink items-center gap-1 text-[12.5px] text-text-tertiary select-none overflow-hidden">
        <IconProjectFolder size={14} className="text-text-tertiary shrink-0" />
        <span className="min-w-0 max-w-[72px] xs:max-w-[96px] sm:max-w-[120px] truncate font-normal ml-[2px]">
          {activeProject.split(/[/\\]/).pop()}
        </span>
      </div>
    ))}
    {gitInfo && (
      <>
        {(projectSelector || activeProject) && <span className="shrink-0 text-text-tertiary">·</span>}
        <div className="relative min-w-0 shrink" ref={branchMenuRef}>
          <button
            type="button"
            disabled={!hasMultipleBranches || isLoading}
            onClick={() => onBranchMenuOpenChange(!isBranchMenuOpen)}
            className={`inline-flex items-center gap-1 px-1 py-0.5 rounded-[5px] text-[12.5px] text-text-tertiary transition-colors duration-150 border-none bg-transparent select-none group ${
              hasMultipleBranches && !isLoading ? 'cursor-pointer hover:text-text-secondary hover:bg-bg-hover' : 'cursor-default'
            }`}
          >
            <IconBranch size={14} className="text-text-tertiary shrink-0" />
            <span className="font-normal max-w-[70px] xs:max-w-[100px] sm:max-w-[120px] truncate">
              {gitInfo.currentBranch}
            </span>
            {hasMultipleBranches && (
              <svg width="7" height="4" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 shrink-0 ${isBranchMenuOpen ? 'rotate-180' : 'opacity-60'}`}>
                <path d="M1 1L5 5L9 1" />
              </svg>
            )}
          </button>

          {isBranchMenuOpen && (
            <div
              className="absolute left-0 bottom-full z-50 mb-1.5 min-w-[160px] max-w-[240px] bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-hidden py-1 animate-[menu-in_150ms_ease-out]"
            >
              <div className="px-3 py-1.5 border-b border-hairline text-[12px] font-normal text-text-tertiary select-none">
                切换 Git 分支
              </div>
              <div className="max-h-[180px] overflow-y-auto py-1 custom-scrollbar">
                {gitInfo.branches.map((branch) => {
                  const isCurrent = branch === gitInfo.currentBranch;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => onCheckoutBranch(branch)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors duration-150 border-none bg-transparent cursor-pointer ${
                        isCurrent
                          ? 'text-accent bg-accent-bg font-medium'
                          : 'text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      <span className="truncate pr-4">{branch}</span>
                      {isCurrent && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>
);

export default ProjectBranchSelector;
