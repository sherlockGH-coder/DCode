import { useCallback, useRef, useState } from 'react';

export type NavView = 'chat' | 'settings';

export interface NavEntry {
  view: NavView;
  conversationId: string | null;
  draftProjectPath?: string | null;
}

interface HistoryState {
  entries: NavEntry[];
  cursor: number;
}

interface UseNavHistoryOptions {
  initial: NavEntry;
  apply: (entry: NavEntry) => void;
}

const MAX_HISTORY = 50;

function getDraftProjectPath(entry: NavEntry): string | null | undefined {
  return Object.prototype.hasOwnProperty.call(entry, 'draftProjectPath')
    ? entry.draftProjectPath ?? null
    : undefined;
}

function entryEquals(a: NavEntry, b: NavEntry): boolean {
  return (
    a.view === b.view &&
    a.conversationId === b.conversationId &&
    getDraftProjectPath(a) === getDraftProjectPath(b)
  );
}

export function useNavHistory({ initial, apply }: UseNavHistoryOptions) {
  const [state, setState] = useState<HistoryState>(() => ({
    entries: [initial],
    cursor: 0,
  }));

  const applyRef = useRef(apply);
  applyRef.current = apply;

  const navigate = useCallback((entry: NavEntry) => {
    setState((prev) => {
      const current = prev.entries[prev.cursor];
      if (current && entryEquals(current, entry)) return prev;

      const truncated = prev.entries.slice(0, prev.cursor + 1);
      let nextEntries = [...truncated, entry];
      let nextCursor = nextEntries.length - 1;

      if (nextEntries.length > MAX_HISTORY) {
        const drop = nextEntries.length - MAX_HISTORY;
        nextEntries = nextEntries.slice(drop);
        nextCursor = nextEntries.length - 1;
      }

      return { entries: nextEntries, cursor: nextCursor };
    });
  }, []);

  const back = useCallback(() => {
    let target: NavEntry | undefined;
    setState((prev) => {
      if (prev.cursor <= 0) return prev;
      const nextCursor = prev.cursor - 1;
      target = prev.entries[nextCursor];
      return { ...prev, cursor: nextCursor };
    });
    if (target) applyRef.current(target);
  }, []);

  const forward = useCallback(() => {
    let target: NavEntry | undefined;
    setState((prev) => {
      if (prev.cursor >= prev.entries.length - 1) return prev;
      const nextCursor = prev.cursor + 1;
      target = prev.entries[nextCursor];
      return { ...prev, cursor: nextCursor };
    });
    if (target) applyRef.current(target);
  }, []);

  const replaceCurrentConversationId = useCallback((id: string) => {
    setState((prev) => {
      const current = prev.entries[prev.cursor];
      if (!current || current.view !== 'chat' || current.conversationId !== null) return prev;
      const nextEntries = [...prev.entries];
      nextEntries[prev.cursor] = { view: 'chat', conversationId: id };
      return { ...prev, entries: nextEntries };
    });
  }, []);

  const pruneByConversationId = useCallback((id: string) => {
    setState((prev) => {
      const survivorsUpToCursor = prev.entries
        .slice(0, prev.cursor + 1)
        .filter((e) => e.conversationId !== id);
      const filtered = prev.entries.filter((e) => e.conversationId !== id);
      if (filtered.length === 0) {
        return { entries: [{ view: 'chat', conversationId: null }], cursor: 0 };
      }
      const nextCursor = Math.max(0, survivorsUpToCursor.length - 1);
      return { entries: filtered, cursor: nextCursor };
    });
  }, []);

  return {
    navigate,
    back,
    forward,
    replaceCurrentConversationId,
    pruneByConversationId,
    canBack: state.cursor > 0,
    canForward: state.cursor < state.entries.length - 1,
  };
}
