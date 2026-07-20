import React from 'react';
import { IconCode } from './icons';

interface OverlayViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isMacOS?: boolean;
  isFullscreen?: boolean;
  hideHeader?: boolean;
}

const OverlayView: React.FC<OverlayViewProps> = ({
  isOpen,
  onClose,
  title,
  children,
  isMacOS = false,
  isFullscreen = false,
  hideHeader = false,
}) => {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    overlayRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed top-0 bottom-0 z-40 flex flex-col bg-bg-main overflow-hidden animate-[content-fade-in_180ms_cubic-bezier(0.32,0.72,0,1)]"
      style={{ left: 0, width: '100%' }}
    >
      {!hideHeader && (
        <div
          className="flex items-center h-[40px] px-4 border-b border-hairline bg-bg-main shrink-0 [-webkit-app-region:drag]"
          style={isMacOS && !isFullscreen ? { paddingLeft: 78 } : undefined}
        >
          <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[7px] bg-transparent text-[12.5px] font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 cursor-pointer"
              title="返回应用"
              aria-label="返回应用"
              onClick={onClose}
            >
              <IconCode size={16} />
              <span>返回应用</span>
            </button>
          </div>

          <div className="flex-1 flex justify-center [-webkit-app-region:drag]">
            <h2 className="m-0 text-[14px] font-medium text-text-primary">{title}</h2>
          </div>

          <div className="w-[118px] shrink-0" />
        </div>
      )}

      <div className={`flex-1 ${hideHeader ? 'min-h-0 flex flex-col' : 'overflow-y-auto'}`}>
        {children}
      </div>
    </div>
  );
};

export default OverlayView;
