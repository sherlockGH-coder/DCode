import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import type { BashExecPolicy } from '../../../shared/types';
import { IconCheck } from '../icons';

const ShieldIconDefault: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8a2 2 0 0 1 2 2c0 1.5-2 2-2 3" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ShieldIconAuto: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const ShieldIconFullAccess: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <circle cx="12" cy="15.5" r="0.75" fill="currentColor" />
  </svg>
);

const PERMISSION_OPTIONS: {
  value: BashExecPolicy;
  label: string;
  desc: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  colorClass: string;
}[] = [
  {
    value: 'default',
    label: 'Default Confirmation',
    desc: 'File reads are allowed automatically; commands and file writes require confirmation.',
    Icon: ShieldIconDefault,
    colorClass: 'text-text-secondary',
  },
  {
    value: 'auto_review',
    label: 'Automatic File Operations',
    desc: 'File reads and writes are allowed automatically; terminal commands still require confirmation.',
    Icon: ShieldIconAuto,
    colorClass: 'text-accent',
  },
  {
    value: 'full_access',
    label: 'Full Access',
    desc: 'Fully trusted environment; terminal commands and file operations run automatically.',
    Icon: ShieldIconFullAccess,
    colorClass: 'text-amber-500 dark:text-amber-400',
  },
];

const PermissionSelector: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { settings, patch } = useSettings();

  const currentPolicy: BashExecPolicy = settings?.permissions?.bashExec ?? 'default';
  const currentOption = PERMISSION_OPTIONS.find((opt) => opt.value === currentPolicy) || PERMISSION_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = async (policy: BashExecPolicy) => {
    setIsOpen(false);
    if (policy === currentPolicy) return;
    try {
      await patch({ permissions: { bashExec: policy } });
    } catch (err) {
      console.warn('[PermissionSelector] Failed to update permission policy:', err);
    }
  };

  const IconComp = currentOption.Icon;

  return (
    <div className="relative inline-flex items-center shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        aria-label="Select permission mode"
        aria-expanded={isOpen}
        className={`group ml-0.5 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] border-0 bg-transparent px-2 text-[12.5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
          currentPolicy === 'full_access'
            ? 'text-amber-500 hover:bg-amber-500/10 dark:text-amber-400'
            : currentPolicy === 'auto_review'
            ? 'text-accent hover:bg-accent-bg'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <IconComp size={15} className="shrink-0" />
        <span>{currentOption.label}</span>
        <svg
          width="8"
          height="5"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 opacity-75 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Permission modes"
          className="absolute bottom-full left-0 z-50 mb-2 w-[240px] rounded-[14px] border border-hairline bg-bg-main p-1.5 shadow-floating animate-[menu-in_150ms_ease-out]"
        >
          {PERMISSION_OPTIONS.map((opt) => {
            const isSelected = opt.value === currentPolicy;
            const OptIcon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(opt.value)}
                className={`flex w-full items-start gap-2.5 rounded-[8px] border-none px-2.5 py-2 text-left transition-colors duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-accent-bg text-text-primary'
                    : 'bg-transparent text-text-primary hover:bg-bg-hover'
                }`}
              >
                <OptIcon size={16} className={`mt-0.5 shrink-0 ${opt.colorClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium leading-snug">{opt.label}</span>
                    {isSelected && <IconCheck size={14} className="text-text-secondary shrink-0 ml-1" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionSelector;
