import React, { useCallback, useMemo, useState } from 'react';
import type { ToolItem } from '../../shared/types';
interface QuestionDialogProps {
  item: ToolItem & { kind: 'ask_user_question' };
  onSubmit: (toolCallId: string, answers: Record<string, string>) => void;
}

interface QuestionState {
  question: string;
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
  selected: string[];
  customInput: string;
  useCustom: boolean;
}
const QuestionDialog: React.FC<QuestionDialogProps> = ({ item, onSubmit }) => {
  const questions = item.questions ?? [];
  const [states, setStates] = useState<QuestionState[]>(() => createInitialStates(questions));
  const [submitting, setSubmitting] = useState(false);

  const answeredCount = useMemo(() => states.filter(isAnswered).length, [states]);
  const allAnswered = states.length > 0 && answeredCount === states.length;

  const handleSelect = useCallback((questionIndex: number, label: string) => {
    setStates((prev) => prev.map((state, index) => {
      if (index !== questionIndex) return state;
      if (!state.multiSelect) {
        const selected = state.selected.includes(label) ? [] : [label];
        return { ...state, selected, useCustom: false, customInput: '' };
      }
      const selected = state.selected.includes(label)
        ? state.selected.filter((itemLabel) => itemLabel !== label)
        : [...state.selected, label];
      return { ...state, selected, useCustom: false, customInput: '' };
    }));
  }, []);

  const handleCustomToggle = useCallback((questionIndex: number) => {
    setStates((prev) => prev.map((state, index) => {
      if (index !== questionIndex) return state;
      return {
        ...state,
        useCustom: !state.useCustom,
        selected: [],
        customInput: state.useCustom ? '' : state.customInput,
      };
    }));
  }, []);

  const handleCustomChange = useCallback((questionIndex: number, value: string) => {
    setStates((prev) => prev.map((state, index) => (
      index === questionIndex ? { ...state, customInput: value } : state
    )));
  }, []);

  const handleSubmit = useCallback(() => {
    if (submitting || !allAnswered) return;
    setSubmitting(true);
    onSubmit(item.toolCallId, buildAnswers(states));
  }, [allAnswered, item.toolCallId, onSubmit, states, submitting]);

  if (states.length === 0) return null;
  return (
    <div
      className="overflow-hidden rounded-[10px] border border-hairline bg-bg-main animate-[menu-in_150ms_ease-out]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium leading-5 text-text-primary">
            需要你的选择
          </div>
          <div className="mt-0.5 text-[12px] text-text-tertiary">
            已回答 {answeredCount}/{states.length}
          </div>
        </div>
        <button
          type="button"
          disabled={submitting || !allAnswered}
          onClick={handleSubmit}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] border-0 bg-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? '提交中...' : '提交'}
        </button>
      </div>

      <div className="max-h-[42vh] overflow-y-auto px-4 pb-3 sm:px-5 custom-scrollbar">
        {states.map((state, index) => (
          <QuestionBlock
            key={`${state.question}-${index}`}
            index={index}
            state={state}
            disabled={submitting}
            compact={states.length === 1}
            onSelect={handleSelect}
            onCustomToggle={handleCustomToggle}
            onCustomChange={handleCustomChange}
          />
        ))}
      </div>
    </div>
  );
};
interface QuestionBlockProps {
  index: number;
  state: QuestionState;
  disabled: boolean;
  compact: boolean;
  onSelect: (questionIndex: number, label: string) => void;
  onCustomToggle: (questionIndex: number) => void;
  onCustomChange: (questionIndex: number, value: string) => void;
}
const QuestionBlock: React.FC<QuestionBlockProps> = ({
  index,
  state,
  disabled,
  compact,
  onSelect,
  onCustomToggle,
  onCustomChange,
}) => (
  <section className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
    <div className="mb-2.5 flex items-start gap-2">
      <span className="mt-0.5 max-w-[120px] shrink-0 truncate rounded-[5px] bg-accent-bg px-2 py-0.5 text-[11px] font-medium text-accent">
        {state.header || (compact ? '问题' : `问题 ${index + 1}`)}
      </span>
      {state.multiSelect && (
        <span className="mt-0.5 shrink-0 rounded-[5px] bg-bg-chip px-2 py-0.5 text-[11px] font-normal text-text-tertiary">
          多选
        </span>
      )}
      <p className="min-w-0 flex-1 text-[14px] font-medium leading-6 text-text-primary">
        {state.question}
      </p>
    </div>

    <div className="overflow-hidden rounded-[10px] border border-hairline bg-bg-block">
      {state.options.map((option) => (
        <OptionRow
          key={option.label}
          option={option}
          multiSelect={state.multiSelect}
          selected={state.selected.includes(option.label)}
          disabled={disabled}
          onClick={() => onSelect(index, option.label)}
        />
      ))}
      <CustomOptionRow
        state={state}
        disabled={disabled}
        onToggle={() => onCustomToggle(index)}
        onChange={(value) => onCustomChange(index, value)}
      />
    </div>
  </section>
);
interface OptionRowProps {
  option: { label: string; description: string };
  multiSelect: boolean;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}
const OptionRow: React.FC<OptionRowProps> = ({
  option,
  multiSelect,
  selected,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    disabled={disabled}
    aria-pressed={selected}
    onClick={onClick}
    className={`group flex min-h-[48px] w-full items-center gap-3 border-b border-hairline px-3 py-2.5 text-left transition-colors duration-150 last:border-b-0 cursor-pointer ${
      selected
        ? 'bg-accent-bg text-text-primary'
        : 'bg-transparent text-text-primary hover:bg-bg-hover'
    } disabled:cursor-not-allowed disabled:opacity-65`}
  >
    <ChoiceMark selected={selected} multiSelect={multiSelect} />
    <span className="min-w-0 flex-1">
      <span className={`block text-[13.5px] font-medium leading-5 ${selected ? 'text-accent' : ''}`}>
        {option.label}
      </span>
      {option.description && (
        <span className="mt-0.5 block text-[12px] leading-5 text-text-secondary">
          {option.description}
        </span>
      )}
    </span>
    {selected && (
      <CheckIcon className="shrink-0 text-accent" />
    )}
  </button>
);
interface CustomOptionRowProps {
  state: QuestionState;
  disabled: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}
const CustomOptionRow: React.FC<CustomOptionRowProps> = ({ state, disabled, onToggle, onChange }) => (
  <div className={`${state.useCustom ? 'bg-accent-bg' : 'bg-transparent'}`}>
    <button
      type="button"
      disabled={disabled}
      aria-pressed={state.useCustom}
      onClick={onToggle}
      className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-bg-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-65 border-0 bg-transparent"
    >
      <ChoiceMark selected={state.useCustom} multiSelect={false} />
      <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-5 text-text-primary">
        自定义回答
      </span>
      {state.useCustom && (
        <CheckIcon className="shrink-0 text-accent" />
      )}
    </button>
    {state.useCustom && (
      <div className="px-3 pb-3 pl-11">
        <input
          type="text"
          value={state.customInput}
          onChange={(event) => onChange(event.target.value)}
          placeholder="输入你的答案"
          className="h-9 w-full rounded-[8px] border border-hairline bg-bg-main px-3 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent/45 focus:ring-[3px] focus:ring-accent-bg"
          autoFocus
        />
      </div>
    )}
  </div>
);
const ChoiceMark: React.FC<{ selected: boolean; multiSelect: boolean }> = ({ selected, multiSelect }) => (
  <span
    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors ${
      multiSelect ? 'rounded-[6px]' : 'rounded-full'
    } ${selected ? 'border-accent bg-accent' : 'border-border-strong bg-bg-main'}`}
    aria-hidden
  >
    {selected && (
      multiSelect ? (
        <CheckIcon className="text-white" size={12} strokeWidth={3} />
      ) : (
        <span className="h-2 w-2 rounded-full bg-white" />
      )
    )}
  </span>
);
const CheckIcon: React.FC<{ className?: string; size?: number; strokeWidth?: number }> = ({ className, size = 14, strokeWidth = 2.4 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
function createInitialStates(
  questions: NonNullable<(ToolItem & { kind: 'ask_user_question' })['questions']>,
): QuestionState[] {
  return questions.map((question) => ({ ...question, selected: [], customInput: '', useCustom: false }));
}
function isAnswered(state: QuestionState): boolean {
  if (state.useCustom) return state.customInput.trim().length > 0;
  return state.selected.length > 0;
}
function buildAnswers(states: QuestionState[]): Record<string, string> {
  return Object.fromEntries(states.map((state) => {
    const selectedAnswer = state.multiSelect ? state.selected.join(', ') : state.selected[0] ?? '';
    const answer = state.useCustom ? state.customInput.trim() : selectedAnswer;
    return [state.question, answer];
  }));
}
export default QuestionDialog;
