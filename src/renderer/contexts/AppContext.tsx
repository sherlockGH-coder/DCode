import React, { createContext, useContext, ReactNode, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSidebar } from '../hooks/useSidebar';
import { useModels } from '../hooks/useModels';
import { useProject } from '../hooks/useProject';
import { useSettings } from '../hooks/useSettings';
import { useRightPanel } from '../hooks/useRightPanel';
import { useBottomPanel } from '../hooks/useBottomPanel';
import { useWindowChrome } from '../hooks/useWindowChrome';
import { initPathContext } from '../utils/collapsePath';
import type { PreviewItem } from '../types/preview';

interface AppContextValue {
  sidebar: ReturnType<typeof useSidebar>;
  models: ReturnType<typeof useModels>;
  project: ReturnType<typeof useProject>;
  settings: ReturnType<typeof useSettings>;
  rightPanel: ReturnType<typeof useRightPanel>;
  bottomPanel: ReturnType<typeof useBottomPanel>;
  windowChrome: ReturnType<typeof useWindowChrome>;
  preview: PreviewItem | null;
  setPreview: (item: PreviewItem | null) => void;
  previews: PreviewItem[];
  activeTitle: string | null;
  setActiveTitle: (title: string | null) => void;
  closeTab: (title: string) => void;
  activeImage: { src: string; title?: string } | null;
  setActiveImage: (img: { src: string; title?: string } | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);
const PreviewActionsContext = createContext<Pick<AppContextValue, 'setPreview'> | undefined>(undefined);
const ModelsContext = createContext<ReturnType<typeof useModels> | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const sidebar = useSidebar();
  const models = useModels();
  const project = useProject();
  const settings = useSettings();
  const rightPanel = useRightPanel();
  const bottomPanel = useBottomPanel();
  const windowChrome = useWindowChrome();
  const [homeDir, setHomeDir] = useState('');

  useEffect(() => {
    let mounted = true;
    window.electronEnv?.getHomeDir()
      .then((home) => {
        if (mounted) setHomeDir(home);
      })
      .catch(() => {
        if (mounted) setHomeDir('');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    initPathContext(project.activeProject || '', homeDir);
  }, [project.activeProject, homeDir]);

  const [previews, setPreviewsState] = useState<PreviewItem[]>([]);
  const [activeTitle, setActiveTitleState] = useState<string | null>(null);
  const previewsRef = useRef<PreviewItem[]>([]);
  const activeTitleRef = useRef<string | null>(null);

  const setActiveTitle = useCallback((title: string | null) => {
    activeTitleRef.current = title;
    setActiveTitleState(title);
  }, []);

  const preview = useMemo(() => {
    if (!activeTitle) return null;
    return previews.find(p => p.title === activeTitle) || null;
  }, [previews, activeTitle]);

  const [activeImage, setActiveImage] = useState<{ src: string; title?: string } | null>(null);

  const setPreview = useCallback((item: PreviewItem | null) => {
    if (item === null) {
      const currentActiveTitle = activeTitleRef.current;
      if (currentActiveTitle) {
        const currentPreviews = previewsRef.current;
        const index = currentPreviews.findIndex(p => p.title === currentActiveTitle);
        const nextPreviews = currentPreviews.filter(p => p.title !== currentActiveTitle);
        previewsRef.current = nextPreviews;
        setPreviewsState(nextPreviews);
        if (nextPreviews.length > 0) {
          const nextIndex = Math.max(0, index - 1);
          setActiveTitle(nextPreviews[nextIndex].title);
        } else {
          setActiveTitle(null);
          rightPanel.setCollapsed(true);
        }
      } else {
        previewsRef.current = [];
        setPreviewsState([]);
        setActiveTitle(null);
        rightPanel.setCollapsed(true);
      }
      setActiveImage(null);
    } else if (item.type === 'image') {
      setActiveImage({ src: item.content, title: item.title });
    } else {
      setPreviewsState(prev => {
        const exists = prev.some(p => p.title === item.title);
        const next = exists
          ? prev.map(p => p.title === item.title ? item : p)
          : [...prev, item];
        previewsRef.current = next;
        return next;
      });
      setActiveTitle(item.title);
      rightPanel.setCollapsed(false);
    }
  }, [rightPanel.setCollapsed, setActiveTitle]);

  const closeTab = useCallback((title: string) => {
    const currentPreviews = previewsRef.current;
    const index = currentPreviews.findIndex(p => p.title === title);
    const nextPreviews = currentPreviews.filter(p => p.title !== title);
    previewsRef.current = nextPreviews;
    setPreviewsState(nextPreviews);
    if (activeTitleRef.current === title) {
      if (nextPreviews.length > 0) {
        const nextIndex = Math.max(0, index - 1);
        setActiveTitle(nextPreviews[nextIndex].title);
      } else {
        setActiveTitle(null);
        rightPanel.setCollapsed(true);
      }
    }
  }, [rightPanel.setCollapsed, setActiveTitle]);

  const value = useMemo(() => ({
    sidebar,
    models,
    project,
    settings,
    rightPanel,
    bottomPanel,
    windowChrome,
    preview,
    setPreview,
    previews,
    activeTitle,
    setActiveTitle,
    closeTab,
    activeImage,
    setActiveImage,
  }), [sidebar, models, project, settings, rightPanel, bottomPanel, windowChrome, preview, setPreview, previews, activeTitle, setActiveTitle, closeTab, activeImage, setActiveImage]);

  const previewActions = useMemo(() => ({ setPreview }), [setPreview]);

  return (
    <AppContext.Provider value={value}>
      <ModelsContext.Provider value={models}>
        <PreviewActionsContext.Provider value={previewActions}>
          {children}
        </PreviewActionsContext.Provider>
      </ModelsContext.Provider>
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const usePreviewActions = () => {
  const context = useContext(PreviewActionsContext);
  if (context === undefined) {
    throw new Error('usePreviewActions must be used within AppProvider');
  }
  return context;
};

export const useModelsContext = () => {
  const context = useContext(ModelsContext);
  if (context === undefined) {
    throw new Error('useModelsContext must be used within AppProvider');
  }
  return context;
};
