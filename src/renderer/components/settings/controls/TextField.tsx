import React from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'url';
  hint?: string;
  disabled?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder, type = 'text', hint, disabled }) => (
  <div className="mb-4">
    {label && <label className="block text-[13px] font-bold text-text-primary mb-1.5">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2.5 border border-black/[0.04] dark:border-white/[0.04] rounded-lg bg-black/[0.025] dark:bg-white/[0.025] hover:bg-black/[0.045] dark:hover:bg-white/[0.045] text-[13px] text-text-primary placeholder:text-text-tertiary shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.01)] transition-all focus:bg-white dark:focus:bg-zinc-950 focus:border-accent/40 focus:ring-3 focus:ring-accent/15 focus:outline-none disabled:opacity-50"
    />
    {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-tertiary font-normal">{hint}</p>}
  </div>
);

export default TextField;
