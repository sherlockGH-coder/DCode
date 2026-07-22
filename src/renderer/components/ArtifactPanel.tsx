import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import EmptyWorkspace from './artifact-panel/EmptyWorkspace';
import FullscreenOverlay from './artifact-panel/FullscreenOverlay';
import PreviewContent from './artifact-panel/PreviewContent';
import { dirPathFromFilePath, stripDiffSuffix } from './artifact-panel/utils';
import { useFullscreenBodyClass } from './artifact-panel/useFullscreenBodyClass';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconCopy,
  IconDots,
  IconExternalOpen,
  IconFolderOpen,
  IconPlus,
  IconX,
  IconPanelsRight,
  IconSidebarTerminal,
  getFileIcon,
} from './icons';
import type { FileOpenOption } from '../../shared/types';
import { buildWorkspaceBreadcrumbSegments } from '../utils/workspaceBreadcrumb';
import { buildPreviewFromAttachment } from '../utils/filePreview';

const WORKSPACE_TAB_BASE_CLASS = 'group inline-flex h-7 min-w-0 max-w-[156px] shrink-0 items-center gap-1.5 rounded-[7px] border-0 px-2.5 text-left transition-colors duration-150 cursor-pointer select-none';
const WORKSPACE_TAB_ACTIVE_CLASS = 'bg-bg-hover text-text-primary';
const WORKSPACE_TAB_IDLE_CLASS = 'text-text-secondary hover:bg-bg-hover hover:text-text-primary';
const WORKSPACE_ICON_ACTION_CLASS = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-secondary';
const WORKSPACE_ICON_ACTION_ACTIVE_CLASS = 'text-accent hover:text-accent';
const WORKSPACE_OPEN_GROUP_CLASS = 'relative ml-1 inline-flex h-7 shrink-0 items-stretch overflow-visible rounded-[7px] border border-hairline bg-transparent transition-colors duration-150 hover:border-border-strong';
const WORKSPACE_OPEN_MAIN_CLASS = 'inline-flex h-full items-center gap-1.5 rounded-l-[6px] border-0 bg-transparent px-2.5 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';
const WORKSPACE_OPEN_TOGGLE_CLASS = 'inline-flex h-full w-7 items-center justify-center rounded-r-[6px] border-0 border-l border-hairline bg-transparent text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary';
const WORKSPACE_MENU_CLASS = 'absolute right-0 top-full mt-1.5 z-[70] w-60 rounded-[14px] border border-hairline bg-bg-main p-1 shadow-floating text-[13px] text-text-primary animate-[menu-in_150ms_ease-out]';
const WORKSPACE_MENU_ITEM_CLASS = 'flex w-full items-center gap-3 rounded-[8px] border-0 bg-transparent px-2.5 py-2 text-left text-[13.5px] font-normal text-text-primary transition-colors hover:bg-bg-hover';
const WORKSPACE_MENU_STATE_CLASS = 'px-3 py-3 text-center text-[12px] font-normal text-text-secondary';

export interface RecentEdit {
  path: string;
  title: string;
  diff: string;
  label: string;
}

interface ArtifactPanelProps {
  recentEdits?: RecentEdit[];
  activeProject?: string | null;
}

const ArtifactPanel: React.FC<ArtifactPanelProps> = memo(({
  recentEdits = [],
  activeProject = null,
}) => {
  const { preview, setPreview, previews, activeTitle, setActiveTitle, closeTab, rightPanel, bottomPanel } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [openWithMenuOpen, setOpenWithMenuOpen] = useState(false);
  const [openOptions, setOpenOptions] = useState<FileOpenOption[]>([]);
  const [openOptionsLoading, setOpenOptionsLoading] = useState(false);
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);

  const cleanTitle = useMemo(() => preview ? stripDiffSuffix(preview.title) : '', [preview]);
  const breadcrumbSegments = useMemo(() => buildWorkspaceBreadcrumbSegments({
    title: cleanTitle,
    filePath: preview?.filePath,
    projectPath: activeProject,
  }), [activeProject, cleanTitle, preview?.filePath]);
  const displayBreadcrumb = useMemo(
    () => breadcrumbSegments.map((segment) => segment.label).join(' > '),
    [breadcrumbSegments],
  );
  const handleBreadcrumbWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) return;

    event.preventDefault();
    el.scrollLeft += delta;
  }, []);

  const isDarkTheme = false;

  useFullscreenBodyClass(fullscreen, setFullscreen);

  useEffect(() => {
    setActionMenuOpen(false);
    setOpenWithMenuOpen(false);
    setOpenOptions([]);
    setOpenFeedback(null);
  }, [preview?.filePath]);

  const handleCopy = useCallback(async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [preview]);

  const handleDownload = useCallback(() => {
    if (!preview) return;
    const blob = new Blob([preview.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = preview.title || 'download';
    a.click();
    URL.revokeObjectURL(url);
  }, [preview]);

  const handleAddLocalFile = useCallback(async () => {
    try {
      const [attachment] = await window.deepseekApi.pickFiles();
      if (!attachment) return;

      const previewItem = await buildPreviewFromAttachment(attachment);
      if (!previewItem) {
        console.warn('[ArtifactPanel] 无法读取工作区文件:', attachment.path);
        return;
      }
      setPreview(previewItem);
    } catch (err) {
      console.error('[ArtifactPanel] 打开本地文件失败:', err);
    }
  }, [setPreview]);

  const showOpenFeedback = useCallback((message: string) => {
    setOpenFeedback(message);
    window.setTimeout(() => {
      setOpenFeedback((current) => current === message ? null : current);
    }, 2400);
  }, []);

  const loadOpenOptions = useCallback(async () => {
    if (!preview?.filePath) return;
    setOpenOptionsLoading(true);
    try {
      const options = await window.deepseekApi.getFileOpenOptions(preview.filePath);
      setOpenOptions(options);
      if (options.length === 0) showOpenFeedback('文件不可打开或不存在');
    } catch (err) {
      console.error('[ArtifactPanel] 获取打开方式失败:', err);
      setOpenOptions([]);
      showOpenFeedback('获取打开方式失败');
    } finally {
      setOpenOptionsLoading(false);
    }
  }, [preview?.filePath, showOpenFeedback]);

  const handleOpenWith = useCallback(async (optionId: string, optionName?: string) => {
    if (!preview?.filePath) return;
    setOpenWithMenuOpen(false);
    try {
      const result = await window.deepseekApi.openFileWith(preview.filePath, optionId);
      if (!result.success) {
        const label = result.name ?? optionName ?? '打开方式';
        console.error(`[ArtifactPanel] 打开文件失败 (${label}):`, result.error);
        showOpenFeedback(result.error ?? `${label} 打开失败`);
        return;
      }
      showOpenFeedback(`已发送到 ${result.name ?? optionName ?? '打开方式'}`);
    } catch (err) {
      console.error(`[ArtifactPanel] 打开文件失败 (${optionId}):`, err);
      showOpenFeedback(err instanceof Error ? err.message : '打开失败');
    }
  }, [preview?.filePath, showOpenFeedback]);

  const handleOpenFile = useCallback(() => {
    void handleOpenWith('default', 'Default app');
  }, [handleOpenWith]);

  const handleOpenFolder = useCallback(() => {
    void handleOpenWith('reveal', 'Finder');
  }, [handleOpenWith]);

  const contentEl = useMemo(
    () => <PreviewContent preview={preview} isDarkTheme={isDarkTheme} />,
    [preview, isDarkTheme],
  );

  const folderPath = dirPathFromFilePath(preview?.filePath);
  const defaultOpenOption = openOptions.find((option) => option.id === 'default');
  const revealTargetLabel = window.electronEnv?.platform === 'darwin' ? '在 Finder 中显示' : '在文件管理器中显示';

  const content = (
    <div className="flex flex-col h-full bg-bg-main">
      {                               }
      <>
        <div className={`flex h-[44px] shrink-0 items-center justify-between bg-bg-main select-none py-1.5 pl-2.5 pr-2 ${!preview ? 'border-b border-hairline' : ''}`}>
          <div
            className="flex h-full min-w-0 flex-1 items-center overflow-x-auto scrollbar-none gap-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            role="tablist"
            aria-label="工作区标签"
          >
            {previews.length === 0 ? (
              <div className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-bg-hover px-2.5 text-text-primary">
                <span className="min-w-0 truncate text-[12.5px] font-medium">
                  工作区
                </span>
              </div>
            ) : previews.map((item) => {
              const isActive = item.title === activeTitle;
              const cleanTabTitle = stripDiffSuffix(item.title);
              return (
                <div
                  key={item.title}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  onClick={() => setActiveTitle(item.title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTitle(item.title);
                    }
                  }}
                  title={item.title}
                  className={`${WORKSPACE_TAB_BASE_CLASS} ${isActive ? WORKSPACE_TAB_ACTIVE_CLASS : WORKSPACE_TAB_IDLE_CLASS}`}
                >
                  <div className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                    <span className="flex items-center justify-center transition-opacity duration-150 group-hover:opacity-0">
                      {getFileIcon(cleanTabTitle.split('.').pop()?.toLowerCase() || '', cleanTabTitle)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(item.title);
                      }}
                      className="absolute inset-0 flex items-center justify-center rounded-full text-text-secondary opacity-0 transition-opacity duration-150 hover:bg-bg-hover hover:text-text-primary group-hover:opacity-100 focus:opacity-100"
                      title="关闭标签页"
                      aria-label="关闭标签页"
                    >
                      <IconX size={8} className="stroke-[3]" />
                    </button>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-none">
                    {cleanTabTitle}
                  </span>
                </div>
              );
            })}
              <button
                type="button"
                onClick={handleAddLocalFile}
                className={`${WORKSPACE_ICON_ACTION_CLASS} ml-1`}
                title="打开文件到工作区"
                aria-label="打开文件到工作区"
              >
                <IconPlus size={13} />
              </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 [-webkit-app-region:no-drag]">
            {                     }
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              disabled={!preview}
              className={`${WORKSPACE_ICON_ACTION_CLASS} ${fullscreen ? WORKSPACE_ICON_ACTION_ACTIVE_CLASS : ''}`}
              title={fullscreen ? '退出全屏' : '全屏'}
              aria-label={fullscreen ? '退出全屏' : '全屏'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {fullscreen ? (
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                ) : (
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                )}
              </svg>
            </button>

            {                            }
            <button
              type="button"
              onClick={() => bottomPanel.setCollapsed(!bottomPanel.collapsed)}
              className={`${WORKSPACE_ICON_ACTION_CLASS} ${!bottomPanel.collapsed ? WORKSPACE_ICON_ACTION_ACTIVE_CLASS : ''}`}
              title={!bottomPanel.collapsed ? '隐藏终端' : '显示终端'}
              aria-label={!bottomPanel.collapsed ? '隐藏终端' : '显示终端'}
            >
              <IconSidebarTerminal size={14} />
            </button>

            {                                  }
            <button
              type="button"
              onClick={() => rightPanel.setCollapsed(!rightPanel.collapsed)}
              className={`${WORKSPACE_ICON_ACTION_CLASS} ${!rightPanel.collapsed ? WORKSPACE_ICON_ACTION_ACTIVE_CLASS : ''}`}
              title="收起工作区"
              aria-label="收起工作区"
            >
              <IconPanelsRight size={14} />
            </button>
          </div>
        </div>

        {preview && (
          <div className="flex h-[38px] shrink-0 items-center justify-between gap-3 border-b border-hairline bg-bg-main pl-3 pr-2 select-none">
            <div
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-none text-[12.5px] leading-normal select-text py-0.5"
              aria-label={displayBreadcrumb}
              onWheel={handleBreadcrumbWheel}
            >
              <div className="inline-flex min-w-max items-center whitespace-nowrap">
                {breadcrumbSegments.map((segment, index) => {
                  const isLast = index === breadcrumbSegments.length - 1;
                  const segmentClass = isLast
                    ? 'shrink-0 font-medium text-text-primary'
                    : 'shrink-0 font-normal text-text-secondary';
                  return (
                    <React.Fragment key={segment.id}>
                      {index > 0 && (
                        <IconChevronRight size={12} className="mx-1.5 shrink-0 text-text-tertiary select-none" />
                      )}
                      <span className={segmentClass}>
                        {segment.label}
                      </span>
                    </React.Fragment>
                  );
                })}
                {preview.initialLine ? (
                  <>
                    <IconChevronRight size={12} className="mx-1.5 shrink-0 text-text-tertiary select-none" />
                    <span className="shrink-0 font-medium text-accent">
                      L{preview.initialLine}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {openFeedback && (
                <span className="max-w-[180px] truncate rounded-[7px] bg-bg-chip px-2 py-1 text-[11px] font-normal text-text-secondary" title={openFeedback}>
                  {openFeedback}
                </span>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setOpenWithMenuOpen(false);
                    setActionMenuOpen((v) => !v);
                  }}
                  title="更多操作"
                  className={`${WORKSPACE_ICON_ACTION_CLASS} relative`}
                  aria-label="更多操作"
                >
                  <IconDots size={13} className="text-current" />
                </button>
                {actionMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setActionMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-[70] w-36 rounded-[14px] border border-hairline bg-bg-main shadow-floating py-1 text-[13px] text-text-primary animate-[menu-in_150ms_ease-out]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover transition-colors"
                      >
                        {copied ? (
                          <IconCheck size={14} className="text-accent shrink-0" />
                        ) : (
                          <IconCopy size={14} className="text-text-secondary shrink-0" />
                        )}
                        <span>{copied ? '已复制' : '复制内容'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownload();
                          setActionMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover transition-colors"
                      >
                        <svg className="text-text-secondary shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        <span>下载文件</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className={WORKSPACE_OPEN_GROUP_CLASS}>
                <button
                  type="button"
                  onClick={handleOpenFile}
                  disabled={!preview.filePath}
                  className={WORKSPACE_OPEN_MAIN_CLASS}
                  title="用系统默认应用打开"
                  aria-label="用系统默认应用打开"
                >
                  {defaultOpenOption?.iconDataUrl ? (
                    <img src={defaultOpenOption.iconDataUrl} alt="" className="h-4 w-4 shrink-0 rounded-[4px]" />
                  ) : (
                    <IconExternalOpen size={14} className="shrink-0 text-text-secondary" />
                  )}
                  <span className="leading-none">打开</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    const nextOpen = !openWithMenuOpen;
                    setOpenWithMenuOpen(nextOpen);
                    if (nextOpen) void loadOpenOptions();
                  }}
                  disabled={!preview.filePath}
                  className={WORKSPACE_OPEN_TOGGLE_CLASS}
                  title="选择打开方式"
                  aria-label="选择打开方式"
                  aria-haspopup="menu"
                  aria-expanded={openWithMenuOpen}
                >
                  <IconChevronDown size={11} className="text-current" />
                </button>
                {openWithMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setOpenWithMenuOpen(false)} />
                    <div className={WORKSPACE_MENU_CLASS} role="menu" aria-label="打开方式">
                      {openOptionsLoading ? (
                        <div className={WORKSPACE_MENU_STATE_CLASS}>正在获取打开方式...</div>
                      ) : openOptions.length === 0 ? (
                        <div className={WORKSPACE_MENU_STATE_CLASS}>文件不可打开或不存在</div>
                      ) : openOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitem"
                          onClick={() => void handleOpenWith(option.id, option.name)}
                          className={WORKSPACE_MENU_ITEM_CLASS}
                        >
                          {option.iconDataUrl ? (
                            <img src={option.iconDataUrl} alt="" className="h-6 w-6 shrink-0 rounded-[5px]" />
                          ) : option.target === 'default' ? (
                            <IconExternalOpen size={18} className="h-6 w-6 shrink-0 rounded-[5px] p-0.5 text-text-secondary" />
                          ) : (
                            <IconCode size={18} className="h-6 w-6 shrink-0 rounded-[5px] p-0.5 text-text-secondary" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{option.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenFolder}
                disabled={!folderPath}
                className={WORKSPACE_ICON_ACTION_CLASS}
                title={revealTargetLabel}
                aria-label={revealTargetLabel}
              >
                <IconFolderOpen size={14} />
              </button>
            </div>
          </div>
        )}
      </>

      {             }
      <div className="flex-1 overflow-auto bg-bg-main">
        {preview ? (
          contentEl
        ) : (
          <EmptyWorkspace />
        )}
      </div>
    </div>
  );

  if (fullscreen && preview) {
    return (
      <FullscreenOverlay
        baseContent={content}
        contentEl={contentEl}
        onClose={() => setFullscreen(false)}
      />
    );
  }

  return content;
});

export default ArtifactPanel;
