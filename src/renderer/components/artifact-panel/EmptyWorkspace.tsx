import React from 'react';

const EmptyWorkspace: React.FC = () => (
  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-white text-text-tertiary">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    </div>
    <div className="text-[13px] font-semibold text-text-secondary">暂无打开的工作区内容</div>
    <div className="mt-1 max-w-[220px] text-[11.5px] leading-relaxed text-text-tertiary">
      文件、diff、预览和执行计划会在这里打开。
    </div>
  </div>
);

export default EmptyWorkspace;
