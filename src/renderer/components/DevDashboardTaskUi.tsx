import React from 'react';

export const EmptyState: React.FC<{
  illustration: React.ReactNode;
  title: string;
  description: string;
}> = ({ illustration, title, description }) => (
  <div className="flex h-full min-h-0 flex-col items-center justify-center px-5 py-6 text-center select-none">
    <div className="mb-4 flex items-center justify-center text-text-tertiary/40">
      {illustration}
    </div>
    <div className="text-[12.5px] font-bold text-text-secondary">{title}</div>
    <div className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-text-tertiary">{description}</div>
  </div>
);
