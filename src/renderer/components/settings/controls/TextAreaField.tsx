import React from 'react';

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  monospace?: boolean;
  disabled?: boolean;
}

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 8,
  monospace = false,
  disabled,
}) => (
  <div className="mb-4">
    <label className="block text-[13px] font-medium text-text-primary mb-1.5">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={`w-full px-3 py-2 border border-border rounded-lg bg-bg-main text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none disabled:opacity-50 resize-y leading-[1.5] ${
        monospace ? 'font-mono' : ''
      }`}
    />
    {hint && <p className="mt-1 text-[11px] text-text-tertiary whitespace-pre-line">{hint}</p>}
  </div>
);

export default TextAreaField;
