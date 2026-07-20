import React, { useRef, useState } from 'react';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  masked?: boolean;
}

const PasswordField: React.FC<PasswordFieldProps> = ({ label, value, onChange, placeholder, hint, masked }) => {
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMaskedDisplay = masked && !value && !editing;
  const displayValue = isMaskedDisplay ? '••••••••••••••••••••••••••••••••' : value;

  const handleToggle = () => {
    if (isMaskedDisplay) {
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setShow(!show);
    }
  };

  return (
    <div className="mb-4">
      {label && <label className="block text-[13px] font-bold text-text-primary mb-1.5">{label}</label>}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={displayValue}
          readOnly={isMaskedDisplay}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (isMaskedDisplay) setEditing(true); }}
          onBlur={() => { if (!value) setEditing(false); }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 border border-black/[0.04] dark:border-white/[0.04] rounded-lg bg-black/[0.025] dark:bg-white/[0.025] hover:bg-black/[0.045] dark:hover:bg-white/[0.045] text-[13px] text-text-primary placeholder:text-text-tertiary shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.01)] transition-all focus:bg-white dark:focus:bg-zinc-950 focus:border-accent/40 focus:ring-3 focus:ring-accent/15 focus:outline-none"
        />
        <button
          type="button"
          className="px-4 py-2.5 border border-black/[0.08] dark:border-white/[0.08] rounded-lg bg-white dark:bg-zinc-950 text-[12.5px] font-semibold text-text-secondary hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:text-text-primary cursor-pointer whitespace-nowrap transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          onClick={handleToggle}
        >
          {isMaskedDisplay ? '编辑' : show ? '隐藏' : '显示'}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-tertiary font-normal">{hint}</p>}
    </div>
  );
};

export default PasswordField;
