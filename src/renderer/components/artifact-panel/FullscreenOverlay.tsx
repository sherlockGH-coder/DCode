import React from 'react';

const FullscreenOverlay: React.FC<{
  baseContent: React.ReactNode;
  contentEl: React.ReactNode;
  onClose: () => void;
}> = ({ baseContent, contentEl, onClose }) => (
  <>
    {baseContent}
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col m-4 sm:m-8 md:m-12 rounded-xl overflow-hidden shadow-2xl flex-1 min-h-0 bg-bg-workspace relative">
        <div className="flex-1 overflow-auto bg-bg-workspace">
          {contentEl}
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-black/5 hover:bg-black/10 text-text-tertiary hover:text-text-secondary transition-colors"
          title="关闭全屏 (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </>
);

export default FullscreenOverlay;
