import React, { useEffect, useRef } from 'react';

const ConfirmDialog: React.FC<{
  children: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}> = ({ children, confirmLabel, onCancel, onConfirm, title }) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.35)] backdrop-blur-[2px] animate-[content-fade-in_150ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className="bg-bg-main rounded-2xl shadow-floating w-[380px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-text-primary mb-1.5">{title}</h3>
        <p className="text-[13.5px] text-text-secondary leading-relaxed mb-5">
          {children}
        </p>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            className="px-4 py-2 text-[13px] font-medium border border-border rounded-lg bg-transparent text-text-primary cursor-pointer hover:bg-bg-hover transition-colors duration-150"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="px-4 py-2 text-[13px] font-medium border-none rounded-lg bg-[#ff3b30] text-white cursor-pointer hover:bg-[#e0352b] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b30]/40"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
