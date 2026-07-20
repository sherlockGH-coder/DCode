import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface FilePathTooltipProps {
  /** 触发 tooltip 的 DOM 元素 ref */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** tooltip 显示的完整路径 */
  text: string;
}

/**
 * 文件路径悬停 tooltip，通过 createPortal 渲染到 document.body，
 * 避免被祖先元素的 overflow:hidden 裁剪（如侧边栏遮挡）。
 *
 * 用法：在需要 tooltip 的元素上挂 ref，并将该 ref 和路径文本传入此组件。
 * 组件自动监听 trigger 的 mouseenter/mouseleave/focus/blur 来控制显隐。
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
