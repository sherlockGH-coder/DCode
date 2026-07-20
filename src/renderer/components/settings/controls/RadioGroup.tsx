import React from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface RadioGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

function RadioGroup<T extends string>({ label, options, value, onChange }: RadioGroupProps<T>): React.ReactElement {
  const isBinary = options.length === 2;

  return (
    <div className="mb-4">
      {label && <label className="block text-[13px] font-semibold text-text-primary mb-3">{label}</label>}
      <div className={`grid ${isBinary ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`group flex items-start gap-3 w-full px-4 py-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                selected
                  ? 'border-accent/40 bg-accent/[0.015] dark:bg-accent/[0.05] shadow-[0_0_0_1px_rgba(37,99,235,0.1)]'
                  : 'border-black/[0.05] dark:border-white/[0.05] bg-white dark:bg-zinc-950 hover:border-black/[0.15] dark:hover:border-white/[0.15] hover:bg-black/[0.005] dark:hover:bg-white/[0.005] shadow-[0_1px_2px_rgba(0,0,0,0.01)]'
              }`}
              onClick={() => onChange(opt.value)}
            >
              {                   }
              <span
                className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                  selected
                    ? 'border-accent bg-accent shadow-[0_1px_2px_rgba(37,99,235,0.2)]'
                    : 'border-black/25 dark:border-white/25 bg-transparent group-hover:border-black/40 dark:group-hover:border-white/40'
                }`}
                aria-hidden
              >
                {selected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white scale-[1.1] transition-transform shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)]" />
                )}
              </span>

              {        }
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] leading-snug block ${selected ? 'font-semibold text-text-primary' : 'text-text-primary font-medium'}`}>
                  {opt.label}
                </span>
                {opt.desc && (
                  <p className="mt-1 text-[11.5px] text-text-tertiary leading-relaxed font-normal">{opt.desc}</p>
                )}
              </div>

              {          }
              {opt.icon && (
                <span className={`shrink-0 mt-0.5 transition-colors duration-150 ${
                  selected ? 'text-accent' : 'text-text-tertiary'
                }`}>
                  {opt.icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RadioGroup;
