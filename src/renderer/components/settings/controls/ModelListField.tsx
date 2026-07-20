import React from 'react';
import { IconPlus, IconTrash } from '../../icons';

interface ModelListFieldProps {
  /** 当前自定义模型列表 */
  models: string[];
  /** 当前默认模型名（用于高亮列表项） */
  defaultModel: string;
  /** 列表增删后回调（已 trim + 去重 + 去空） */
  onModelsChange: (next: string[]) => void;
  /** 点击星标把某个模型设为默认 */
  onSetDefault: (model: string) => void;
  placeholder?: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ModelListField: React.FC<ModelListFieldProps> = ({
  models,
  defaultModel,
  onModelsChange,
  onSetDefault,
  placeholder,
}) => {
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalizedModels = React.useMemo(
    () => models.map(normalize).filter(Boolean),
    [models],
  );

  const commitDraft = () => {
    const next = normalize(draft);
    if (!next) {
      setError('请输入模型名');
      inputRef.current?.focus();
      return;
    }
    if (normalizedModels.includes(next)) {
      setError('该模型已添加');
      inputRef.current?.select();
      return;
    }
    setDraft('');
    setError(null);
    onModelsChange([...normalizedModels, next]);
  };

  const remove = (index: number) => {
    setError(null);
    onModelsChange(normalizedModels.filter((_, idx) => idx !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitDraft();
  };

  const canAdd = normalize(draft).length > 0;

  return (
    <div>
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

      {error && (
        <p className="mt-2 text-[11px] leading-relaxed text-red-500">{error}</p>
      )}

      {normalizedModels.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-white">
          {normalizedModels.map((model, index) => {
            const isDefault = model === defaultModel;
            return (
              <div
                key={`${model}-${index}`}
                className={`flex h-10 items-center gap-2 border-b border-border/50 px-2.5 last:border-b-0 ${
                  isDefault ? 'bg-accent/5' : ''
                }`}
              >
                {               }
                <button
                  type="button"
                  onClick={() => onSetDefault(model)}
                  disabled={isDefault}
                  title={isDefault ? '当前默认模型' : '设为默认'}
                  aria-label={isDefault ? `${model}（当前默认）` : `将 ${model} 设为默认`}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent transition-colors ${
                    isDefault
                      ? 'text-accent cursor-default'
                      : 'text-text-tertiary hover:bg-[rgba(0,0,0,0.04)] hover:text-accent cursor-pointer'
                  }`}
                >
                  <StarIcon filled={isDefault} />
                </button>

                <span
                  className={`min-w-0 flex-1 truncate text-[13px] ${
                    isDefault ? 'font-semibold text-accent' : 'text-text-primary'
                  }`}
                >
                  {model}
                </span>

                {isDefault && (
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    默认
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => remove(index)}
                  title="删除模型"
                  aria-label={`删除模型 ${model}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelListField;
