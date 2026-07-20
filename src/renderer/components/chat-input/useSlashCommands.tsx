import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkillSummary } from '../../../shared/types';
import { IconLayers } from '../icons';
import {
  CompactContextRing,
  findSlashTrigger,
  formatCompactSlashCommandDescription,
  normalizeContextUsagePercent,
  removeSlashTrigger,
  type SelectedSlashCommand,
  type SlashCommand,
} from './utils';

export function useSlashCommands({
  contextUsagePercent,
  inputRef,
  inputValue,
  setInputValue,
  skills,
}: {
  contextUsagePercent?: number | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  skills: SkillSummary[];
}) {
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashCommand, setSelectedSlashCommand] = useState<SelectedSlashCommand | null>(null);

  const normalizedContextUsagePercent = normalizeContextUsagePercent(contextUsagePercent);
  const compactDescription = formatCompactSlashCommandDescription(normalizedContextUsagePercent);

  const builtinCommands = useMemo<SlashCommand[]>(() => [
    {
      name: 'compact',
      description: compactDescription,
      icon: <CompactContextRing percent={normalizedContextUsagePercent} />,
      color: '',
      kind: 'text',
    },
    {
      name: 'plan',
      description: '进入计划模式并先制定可审批计划',
      icon: <span aria-hidden>◇</span>,
      color: '',
      kind: 'text',
    },
    {
      name: 'help',
      description: '获取使用帮助与技巧',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      color: '',
      kind: 'text',
    },
  ], [compactDescription, normalizedContextUsagePercent]);

  const { builtinFiltered, skillFiltered } = useMemo(() => {
    const query = (slashFilter || '').toLowerCase();
    const filterFn = <T extends SlashCommand>(items: T[]) =>
      query ? items.filter((command) => command.name.toLowerCase().includes(query) || command.description.toLowerCase().includes(query)) : items;

    const skillCommands: SlashCommand[] = skills
      .filter((skill) => skill.enabled)
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        icon: <IconLayers size={13} className="shrink-0" />,
        color: '',
        kind: 'text' as const,
      }));

    return {
      builtinFiltered: filterFn(builtinCommands),
      skillFiltered: filterFn(skillCommands),
    };
  }, [builtinCommands, skills, slashFilter]);

  const filteredCommands: SlashCommand[] = useMemo(() => {
    return [...builtinFiltered, ...skillFiltered];
  }, [builtinFiltered, skillFiltered]);

  const checkSlashTrigger = useCallback((value: string, cursorPos: number) => {
    const trigger = findSlashTrigger(value, cursorPos);
    if (trigger) {
      setSlashOpen(true);
      setSlashFilter(trigger.filter);
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
      setSlashFilter('');
    }
  }, []);

  const selectSlashCommand = useCallback((command: SlashCommand) => {
    if (command.kind === 'action') {
      command.action?.();
      return;
    }

    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length;
    const next = removeSlashTrigger(inputValue, cursorPos);
    setSelectedSlashCommand({
      name: command.name,
      description: command.description,
      icon: command.icon,
    });
    setInputValue(next.value);
    window.setTimeout(() => {
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
      inputRef.current?.focus();
    }, 0);
    setSlashOpen(false);
    setSlashFilter('');
  }, [inputRef, inputValue, setInputValue]);

  useEffect(() => {
    if (slashOpen && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-selected="true"]');
      activeEl?.scrollIntoView({
        block: 'nearest',
        behavior: 'auto',
      });
    }
  }, [slashIndex, slashOpen]);

  return {
    slashMenuRef,
    scrollContainerRef,
    slashOpen,
    setSlashOpen,
    slashIndex,
    setSlashIndex,
    slashFilter,
    setSlashFilter,
    selectedSlashCommand,
    setSelectedSlashCommand,
    builtinFiltered,
    skillFiltered,
    filteredCommands,
    checkSlashTrigger,
    selectSlashCommand,
  };
}
