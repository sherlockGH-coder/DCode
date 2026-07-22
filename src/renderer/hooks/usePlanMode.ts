import { useCallback, useEffect, useState } from 'react';
import type {
  ConversationModeState,
  PlanDecisionRequest,
  PlanDecisionResult,
} from '../../shared/types';

export function usePlanMode(conversationId: string | null) {
  const [state, setState] = useState<ConversationModeState | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setState(null);
      return;
    }
    let active = true;
    const api = window.deepseekApi;
    if (!api || typeof api.getConversationModeState !== 'function') return;
    void api.getConversationModeState(conversationId).then((next) => {
      if (active) setState(next);
    });
    const unsubscribe = typeof api.onConversationModeStateChanged === 'function'
      ? api.onConversationModeStateChanged((next) => {
      if (active && next.conversationId === conversationId) setState(next);
        })
      : () => {};
    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId]);

  const setMode = useCallback(async (targetMode: 'execute' | 'plan') => {
    if (!conversationId) throw new Error('Create a conversation before changing mode');
    const current = state ?? await window.deepseekApi.getConversationModeState(conversationId);
    setIsTransitioning(true);
    try {
      const next = await window.deepseekApi.setConversationMode({
        conversationId,
        targetMode,
        expectedModeRevision: current.modeRevision,
      });
      setState(next);
      return next;
    } finally {
      setIsTransitioning(false);
    }
  }, [conversationId, state]);

  const decide = useCallback(async (request: PlanDecisionRequest): Promise<PlanDecisionResult> => {
    setIsTransitioning(true);
    try {
      const result = await window.deepseekApi.decidePlan(request);
      setState(result.state);
      return result;
    } finally {
      setIsTransitioning(false);
    }
  }, []);

  return { state, setState, setMode, decide, isTransitioning };
}
