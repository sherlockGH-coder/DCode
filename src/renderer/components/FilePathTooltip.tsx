import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface FilePathTooltipProps {
  /** Ref for the DOM element that triggers the tooltip. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Full path shown in the tooltip. */
  text: string;
}

/**
 * File-path hover tooltip rendered into document.body with createPortal,
 * so ancestor overflow:hidden containers cannot clip it.
 *
 * Attach the ref to the target element and pass the ref and path text to this component.
 * The component listens for mouseenter, mouseleave, focus, and blur on the target.
 */
const FilePathTooltip: React.FC<FilePathTooltipProps> = ({ triggerRef, text }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calcAndShow = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [triggerRef]);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setPos(null), 120);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    el.addEventListener('mouseenter', calcAndShow);
    el.addEventListener('mouseleave', scheduleHide);
    el.addEventListener('focus', calcAndShow);
    el.addEventListener('blur', scheduleHide);

    return () => {
      el.removeEventListener('mouseenter', calcAndShow);
      el.removeEventListener('mouseleave', scheduleHide);
      el.removeEventListener('focus', calcAndShow);
      el.removeEventListener('blur', scheduleHide);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [triggerRef, calcAndShow, scheduleHide]);

  if (!pos) return null;

  return createPortal(
    <div
      className="filepath-tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
        zIndex: 99999,
      }}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      {text}
    </div>,
    document.body,
  );
};

export default FilePathTooltip;
