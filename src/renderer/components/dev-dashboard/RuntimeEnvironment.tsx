import React from 'react';
import { createPortal } from 'react-dom';
import type { GitCommitStatus } from '../../../shared/types';
import { IconBranch } from '../icons';

const CommitIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
    <path d="M3 12h5M16 12h5" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const PushIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </svg>
);

const RuntimeEnvironment: React.FC<{ activeProject: string | null }> = ({ activeProject }) => {
  const [status, setStatus] = React.useState<GitCommitStatus | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [includeUnstaged, setIncludeUnstaged] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState<'commit' | 'commit-push' | 'push' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!activeProject || !window.deepseekApi?.gitGetCommitStatus) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await window.deepseekApi.gitGetCommitStatus(activeProject));
    } catch (refreshError) {
      console.error('[RuntimeEnvironment] failed to load git status:', refreshError);
      setStatus(null);
    }
  }, [activeProject]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  React.useEffect(() => {
    setPanelOpen(false);
    setError(null);
    setMessage('');
  }, [activeProject]);

  const canCommit = Boolean(status?.hasGit && (includeUnstaged ? status.hasChanges : status.hasStagedChanges));
  const canPush = Boolean(status?.hasGit && status.hasRemote && (status.aheadCount > 0 || !status.hasUpstream));

  const finishSuccessfulAction = async () => {
    await refresh();
    setPanelOpen(false);
    setMessage('');
  };

  const handleCommit = async (pushAfterCommit: boolean) => {
    if (!activeProject || !canCommit) return;
    setBusyAction(pushAfterCommit ? 'commit-push' : 'commit');
    setError(null);
    try {
      const commitResult = await window.deepseekApi.gitCommit(activeProject, message, includeUnstaged);
      if (!commitResult.success) {
        setError(commitResult.error || '提交失败。');
        return;
      }
      if (pushAfterCommit) {
        const pushResult = await window.deepseekApi.gitPush(activeProject);
        if (!pushResult.success) {
          await refresh();
          setError(pushResult.error || '提交成功，但推送失败。');
          return;
        }
      }
      await finishSuccessfulAction();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '提交操作失败。');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePush = async () => {
    if (!activeProject || !canPush) return;
    setBusyAction('push');
    setError(null);
    try {
      const result = await window.deepseekApi.gitPush(activeProject);
      if (!result.success) {
        setError(result.error || '推送失败。');
        return;
      }
      await finishSuccessfulAction();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '推送操作失败。');
    } finally {
      setBusyAction(null);
    }
  };

  const panel = panelOpen && status && activeProject ? createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/15 p-4"
      role="presentation"
      onMouseDown={() => {
        if (!busyAction) setPanelOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Commit or push"
        className="w-full max-w-[390px] overflow-hidden rounded-[18px] border border-hairline bg-bg-main shadow-floating"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2 text-[13px] text-text-secondary">
            <IconBranch size={15} className="shrink-0" />
            <span className="truncate font-medium">{status.branch}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[12.5px]">
            <span className="text-diff-add">+{status.additions}</span>
            <span className="text-diff-del">-{status.deletions}</span>
          </div>
        </header>

        <div className="px-5 py-4">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="提交信息（留空将自动生成）"
            aria-label="提交信息"
            disabled={Boolean(busyAction)}
            className="h-10 w-full border-0 border-b border-hairline bg-transparent px-0 text-[14px] text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
          />

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-text-primary">
            <input
              type="checkbox"
              checked={includeUnstaged}
              onChange={(event) => setIncludeUnstaged(event.target.checked)}
              disabled={Boolean(busyAction)}
              className="h-4 w-4 accent-accent"
            />
            包含未暂存的更改
          </label>

          {error && (
            <p className="mt-3 max-h-20 overflow-y-auto rounded-[8px] bg-diff-del-bg px-3 py-2 text-[12px] leading-relaxed text-diff-del">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-hairline p-1.5">
          <button
            type="button"
            disabled={!canCommit || Boolean(busyAction)}
            onClick={() => void handleCommit(false)}
            className="flex h-10 w-full items-center gap-3 rounded-[9px] border-0 bg-transparent px-3 text-left text-[13.5px] font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CommitIcon className="shrink-0" />
            <span>{busyAction === 'commit' ? '正在提交…' : '提交'}</span>
          </button>
          <button
            type="button"
            disabled={!canCommit || !status.hasRemote || Boolean(busyAction)}
            onClick={() => void handleCommit(true)}
            className="flex h-10 w-full items-center gap-3 rounded-[9px] border-0 bg-transparent px-3 text-left text-[13.5px] font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-35"
          >
            <PushIcon className="shrink-0" />
            <span>{busyAction === 'commit-push' ? '正在提交并推送…' : '提交并推送'}</span>
          </button>
          <button
            type="button"
            disabled={!canPush || Boolean(busyAction)}
            onClick={() => void handlePush()}
            className="flex h-10 w-full items-center gap-3 rounded-[9px] border-0 bg-transparent px-3 text-left text-[13.5px] font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-35"
          >
            <PushIcon className="shrink-0" />
            <span>{busyAction === 'push' ? '正在推送…' : '推送'}</span>
          </button>
        </div>
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <section className="shrink-0 border-b border-hairline px-2 pb-2 pt-1" data-testid="runtime-environment">
      <h3 className="px-2 py-2 text-[12px] font-medium text-text-tertiary">运行环境</h3>
      <div className="flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] text-text-primary">
        <IconBranch size={15} className="shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1 truncate">{status?.hasGit ? status.branch : '非 Git 项目'}</span>
      </div>
      <button
        type="button"
        disabled={!status?.hasGit}
        onClick={() => {
          setError(null);
          setPanelOpen(true);
        }}
        className="flex h-8 w-full items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2 text-left text-[13px] text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:text-text-tertiary"
      >
        <CommitIcon className="shrink-0 text-text-secondary" />
        <span className="flex-1">Commit or push</span>
        {status && status.aheadCount > 0 ? (
          <span className="text-[11px] text-text-tertiary">领先 {status.aheadCount}</span>
        ) : null}
      </button>
      {panel}
    </section>
  );
};

export default RuntimeEnvironment;
