import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconBranch } from './icons';

interface WelcomeBranchSelectorProps {
  activeProject: string | null;
}

interface GitInfo {
  currentBranch: string;
  branches: string[];
}

const WelcomeBranchSelector: React.FC<WelcomeBranchSelectorProps> = ({ activeProject }) => {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeProject) {
      setGitInfo(null);
      return;
    }

    let isMounted = true;
    const fetchGitInfo = async () => {
      try {
        const info = await window.deepseekApi.gitGetBranches(activeProject);
        if (isMounted) {
          setGitInfo(info);
        }
      } catch {
        if (isMounted) {
          setGitInfo(null);
        }
      }
    };

    fetchGitInfo();

    const timer = setInterval(fetchGitInfo, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [activeProject]);

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

  const handleCheckoutBranch = useCallback(async (branch: string) => {
    if (!activeProject || isLoading) return;
    setIsLoading(true);
    try {
      const res = await window.deepseekApi.gitCheckoutBranch(activeProject, branch);
      if (res.success) {
        const info = await window.deepseekApi.gitGetBranches(activeProject);
        setGitInfo(info);
        setIsOpen(false);
      } else {
        alert(`切换分支失败: ${res.error}`);
      }
    } catch (err: any) {
      alert(`切换分支失败: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject, isLoading]);

  if (!activeProject || !gitInfo) return null;

  const hasMultipleBranches = gitInfo.branches.length > 1;

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <span className="text-text-tertiary mx-1 select-none">·</span>
      <button
        type="button"
        disabled={!hasMultipleBranches || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 -mx-0.5 rounded-[5px] text-[14px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer border-none bg-transparent select-none group ${
          hasMultipleBranches && !isLoading ? '' : 'cursor-default'
        }`}
      >
        <IconBranch size={15} className="text-text-tertiary shrink-0" />
        <span className="font-normal max-w-[80px] xs:max-w-[120px] sm:max-w-[160px] truncate">
          {gitInfo.currentBranch}
        </span>
        {hasMultipleBranches && (
          <svg
            width="7"
            height="4"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-150 shrink-0 ${
              isOpen ? 'rotate-180' : 'opacity-60'
            }`}
          >
            <path d="M1 1L5 5L9 1" />
          </svg>
        )}
      </button>

      {isOpen && hasMultipleBranches && (
        <div
          className="absolute left-0 bottom-full z-[100] mb-1.5 min-w-[160px] max-w-[240px] bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-hidden py-1 animate-[menu-in_150ms_ease-out] origin-bottom"
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
                  onClick={() => handleCheckoutBranch(branch)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors duration-150 border-none bg-transparent cursor-pointer ${
                    isCurrent
                      ? 'text-accent bg-accent-bg font-medium'
                      : 'text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <span className="truncate pr-4">{branch}</span>
                  {isCurrent && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent shrink-0"
                    >
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
  );
};

export default WelcomeBranchSelector;
