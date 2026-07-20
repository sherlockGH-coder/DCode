import React from 'react';
import { IconPlus, IconTrash } from '../../icons';

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const StringListField: React.FC<StringListFieldProps> = ({
  label,
  values,
  onChange,
  placeholder,
  hint,
}) => {
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalizedValues = React.useMemo(
    () => values.map(normalize).filter(Boolean),
    [values],
  );

  const commitDraft = () => {
    const nextValue = normalize(draft);
    if (!nextValue) {
      setError('请输入一条命令前缀');
      inputRef.current?.focus();
      return;
    }
    if (normalizedValues.includes(nextValue)) {
      setError('这条规则已经存在');
      inputRef.current?.select();
      return;
    }

    setDraft('');
    setError(null);
    onChange([...normalizedValues, nextValue]);
  };

  const remove = (index: number) => {
    setError(null);
    onChange(normalizedValues.filter((_, idx) => idx !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitDraft();
  };

  const canAdd = normalize(draft).length > 0;

  return (
    <div>
      {label && <label className="block text-[13px] font-medium text-text-primary mb-2">{label}</label>}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-9 flex-1 min-w-0 rounded-lg border border-border bg-white px-3 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={!canAdd}
          className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-text-primary transition-colors hover:bg-[rgba(0,0,0,0.035)] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-white"
        >
          <IconPlus size={13} />
          添加
        </button>
      </div>

      {(error || hint) && (
        <p className={`mt-2 text-[11px] leading-relaxed ${error ? 'text-red-500' : 'text-text-tertiary'}`}>
          {error || hint}
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-white">
        {normalizedValues.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-text-tertiary">
            暂无白名单规则。添加后，匹配的终端命令会跳过审批。
          </div>
        ) : (
          normalizedValues.map((value, index) => (
            <div
              key={`${value}-${index}`}
              className="flex h-10 items-center gap-3 border-b border-border/50 px-3 last:border-b-0"
            >
              <code className="min-w-0 flex-1 truncate rounded bg-[rgba(0,0,0,0.035)] px-2 py-1 text-[12px] text-text-primary">
                {value}
              </code>
              <button
                type="button"
                onClick={() => remove(index)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500"
                title="删除规则"
                aria-label={`删除规则 ${value}`}
              >
                <IconTrash size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StringListField;
