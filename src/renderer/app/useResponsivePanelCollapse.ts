import React from 'react';

interface UseResponsivePanelCollapseOptions {
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}
export function useResponsivePanelCollapse({
  rightPanelCollapsed,
  setRightPanelCollapsed,
  sidebarCollapsed,
  setSidebarCollapsed,
}: UseResponsivePanelCollapseOptions): void {

  React.useEffect(() => {
    const RIGHT_THRESHOLD = 1000;
    const SIDEBAR_THRESHOLD = 720;

    let prevWidth = window.innerWidth;

    if (prevWidth < RIGHT_THRESHOLD && !rightPanelCollapsed) {
      setRightPanelCollapsed(true);
    }
    if (prevWidth < SIDEBAR_THRESHOLD && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }

    const handleResize = () => {
      const currentWidth = window.innerWidth;

      if (prevWidth >= RIGHT_THRESHOLD && currentWidth < RIGHT_THRESHOLD) {
        if (!rightPanelCollapsed) {
          setRightPanelCollapsed(true);
        }
      }

      if (prevWidth >= SIDEBAR_THRESHOLD && currentWidth < SIDEBAR_THRESHOLD) {
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true);
        }
      }

      prevWidth = currentWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rightPanelCollapsed, setRightPanelCollapsed, sidebarCollapsed, setSidebarCollapsed]);
}
