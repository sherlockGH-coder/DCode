import React, { useMemo } from 'react';
import type { ChangeUndoEntry, Conversation, Message, ToolItem } from '../../shared/types';
import type { RenderUnit } from '../utils/tool-pipeline';
import { parseDbTimestamp } from '../utils/messageTime';
import { injectToolItems } from '../utils/tool-pipeline/extractToolItems';
import MessageBubble from '../components/MessageBubble';
import RenderUnitView from '../components/RenderUnitView';
import CompressionSeparator from '../components/CompressionSeparator';
import ExplorationActivityGroup, { type ExplorationActivity } from '../components/ExplorationActivityGroup';
import ToolItemCard from '../components/ToolItemCard';
import ProcessedSummary from '../components/ProcessedSummary';

interface UseChatPresentationOptions {
  conversationId: string | null;
  conversations: Conversation[];
  messages: Message[];
  activeAttempts: Record<string, number>;
  visibleMessages: Message[];
  renderUnits: RenderUnit[];
  segmentMessageMap: Map<string, number>;
  tailUnitsByMessageId: Map<string, number[]>;
  lastUserMessage: Message | undefined;
  isLoading: boolean;
  turnTimers: Record<string, { startedAt: number; endedAt?: number }>;
  reasoningEffort?: string;
  onReasoningEffortChange: (effort: string | undefined) => void;
  onEditSubmit: (editedContent: string, editedAttachments?: Message['attachments']) => void | Promise<void>;
  onResponseNav: (turnId: string, direction: -1 | 1) => void;
  onUndoCascade: (turnId: string, entries: ChangeUndoEntry[]) => Promise<boolean>;
  dismissingFromTurnId?: string | null;
}

interface UseChatPresentationResult {
  chatItems: React.ReactNode[];
  pendingApprovalItems: ToolItem[];
}

type TurnGroup =
  | { kind: 'legacy'; message: Message }
  | { kind: 'turn'; turnId: string; messages: Message[] };

const CONTEXT_SUMMARY_MARKER = '[Context summary]';
const LEGACY_CONTEXT_SUMMARY_MARKER = '[\u4e0a\u4e0b\u6587\u6458\u8981]';

function isContextSummaryContent(content?: string): boolean {
  return !!content
    && (content.startsWith(CONTEXT_SUMMARY_MARKER) || content.startsWith(LEGACY_CONTEXT_SUMMARY_MARKER));
}

function stripContextSummaryMarker(content: string): string {
  if (content.startsWith(CONTEXT_SUMMARY_MARKER)) {
    return content.slice(CONTEXT_SUMMARY_MARKER.length).replace(/^\n?/, '');
  }
  if (content.startsWith(LEGACY_CONTEXT_SUMMARY_MARKER)) {
    return content.slice(LEGACY_CONTEXT_SUMMARY_MARKER.length).replace(/^\n?/, '');
  }
  return content;
}

function isExplorationTool(item: ToolItem): boolean {
  return item.kind === 'read'
    || item.kind === 'grep'
    || item.kind === 'glob'
    || item.kind === 'list_directory'
    || item.kind === 'web_search'
    || item.kind === 'web_fetch'
    || item.kind === 'vision';
}

function shouldShowStandaloneTool(item: ToolItem): boolean {
  return item.kind !== 'task' && item.kind !== 'plan_update';
}

export function useChatPresentation({
  conversationId,
  conversations,
  messages,
  activeAttempts,
  visibleMessages,
  renderUnits,
  segmentMessageMap,
  tailUnitsByMessageId,
  lastUserMessage,
  isLoading,
  turnTimers,
  reasoningEffort,
  onReasoningEffortChange,
  onEditSubmit,
  onResponseNav,
  onUndoCascade,
  dismissingFromTurnId,
}: UseChatPresentationOptions): UseChatPresentationResult {
  const pendingApprovalItems = useMemo(() => {
    const approvals: ToolItem[] = [];

    const hydratedMessages = injectToolItems(messages);
    for (const message of hydratedMessages) {
      if (message.role !== 'assistant' || !message.toolItems) continue;

      for (const item of message.toolItems) {
        if (item.status === 'awaiting_approval') approvals.push(item);
      }
    }

    return approvals;
  }, [messages]);

  const chatItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    const dismissingItems: React.ReactNode[] = [];
    const presentationMessages = injectToolItems(messages);
    let isCollectingDismissal = false;
    const renderedUnits = new Set<number>();

    const pushItem = (node: React.ReactNode) => {
      if (isCollectingDismissal) {
        dismissingItems.push(node);
        return;
      }
      items.push(node);
    };

    const maybeStartDismissal = (turnId: string) => {
      if (!dismissingFromTurnId || isCollectingDismissal) return;
      if (turnId === dismissingFromTurnId) isCollectingDismissal = true;
    };

    const undoEntriesFromTurn = (turnId: string): ChangeUndoEntry[] => {
      const startIndex = presentationMessages.findIndex((message) => message.turnId === turnId);
      if (startIndex === -1) return [];
      const changes = presentationMessages.slice(startIndex).flatMap((message) => message.toolItems ?? []).filter(
        (item): item is Extract<ToolItem, { kind: 'write' | 'edit' }> =>
          (item.kind === 'write' || item.kind === 'edit') && item.status === 'done' && !!item.diff,
      );
      return [...changes].reverse().map((item) => ({
        path: item.path,
        diff: item.diff ?? '',
        isNew: item.kind === 'write' ? !!item.isNew : false,
      }));
    };

    const activeConversation = conversations.find((conversation) => conversation.id === conversationId);
    const compactedToMessageId = activeConversation?.compacted_to_message_id;
    const summary = activeConversation?.summary;
    const latestAssistantMessageId = (() => {
      for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
        const message = visibleMessages[index];
        if (message.role === 'assistant' && !isContextSummaryContent(message.content)) return message.id;
      }
      return undefined;
    })();

    const maxByTurn = new Map<string, number>();
    const sortedByTurn = new Map<string, number[]>();
    for (const message of presentationMessages) {
      if (!message.turnId || message.attemptNo === undefined || message.role === 'user') continue;
      const previous = maxByTurn.get(message.turnId);
      if (previous === undefined || message.attemptNo > previous) maxByTurn.set(message.turnId, message.attemptNo);
      let attempts = sortedByTurn.get(message.turnId);
      if (!attempts) {
        attempts = [];
        sortedByTurn.set(message.turnId, attempts);
      }
      if (!attempts.includes(message.attemptNo)) attempts.push(message.attemptNo);
    }
    for (const attempts of sortedByTurn.values()) attempts.sort((a, b) => a - b);

    const activeForTurn = (turnId: string): number => {
      if (activeAttempts[turnId] !== undefined) return activeAttempts[turnId];
      return maxByTurn.get(turnId) ?? 1;
    };

    const lastTurnId = lastUserMessage?.id;
    const groups: TurnGroup[] = [];
    const groupByTurnId = new Map<string, Extract<TurnGroup, { kind: 'turn' }>>();
    for (const message of presentationMessages) {
      if (message.role === 'system') continue;
      if (message.role === 'assistant' && isContextSummaryContent(message.content)) {
        groups.push({ kind: 'legacy', message });
        continue;
      }
      if (!message.turnId) {
        groups.push({ kind: 'legacy', message });
        continue;
      }
      let group = groupByTurnId.get(message.turnId);
      if (!group) {
        group = { kind: 'turn', turnId: message.turnId, messages: [] };
        groupByTurnId.set(message.turnId, group);
        groups.push(group);
      }
      group.messages.push(message);
    }

    const buildTurnAssistantNodes = (
      assistantMessages: Message[],
      options: { turnId: string; activeAttempt: number; isActiveTurn: boolean },
    ): { intermediateNodes: React.ReactNode[]; finalNode: React.ReactNode | null; trailingNodes: React.ReactNode[] } => {
      const nodes: React.ReactNode[] = [];
      const trailingNodes: React.ReactNode[] = [];
      let finalNode: React.ReactNode | null = null;
      let exploration: ExplorationActivity[] = [];
      let trailingExploration: ExplorationActivity[] = [];
      let explorationIndex = 0;
      let foundFinalContent = false;
      const lastContentAssistant = [...assistantMessages].reverse().find((message) => !!message.content?.trim());
      const attempts = sortedByTurn.get(options.turnId) ?? [options.activeAttempt];
      const currentIndex = attempts.indexOf(options.activeAttempt);

      const flushExploration = (intoTrailing: boolean, isActive = false) => {
        const bucket = intoTrailing ? trailingExploration : exploration;
        if (bucket.length === 0) return;
        const target = intoTrailing ? trailingNodes : nodes;
        target.push(
          <ExplorationActivityGroup
            key={`exploration-run-${options.turnId}-${explorationIndex++}`}
            activities={bucket}
            isProcessing={options.isActiveTurn && isActive}
          />,
        );
        if (intoTrailing) trailingExploration = [];
        else exploration = [];
      };

      for (const message of assistantMessages) {
        const unitIndex = segmentMessageMap.get(message.id);
        if (unitIndex !== undefined) renderedUnits.add(unitIndex);
        for (const tailUnitIndex of tailUnitsByMessageId.get(message.id) ?? []) renderedUnits.add(tailUnitIndex);

        if (message.reasoning_content) {

          flushExploration(foundFinalContent);
          (foundFinalContent ? trailingExploration : exploration).push({
            kind: 'reasoning',
            id: `reasoning-${message.id}`,
            content: message.reasoning_content,
            durationMs: message.duration,
            isStreaming:
              options.isActiveTurn
              && message.completed_at == null
              && !message.content?.trim()
              && !(message.toolItems?.length || message.tool_calls?.length),
          });
        }

        if (message.content?.trim()) {
          flushExploration(foundFinalContent);
          const isFinalContent = message.id === lastContentAssistant?.id;
          const hasAwaitingApproval = message.toolItems?.some((item) => item.status === 'awaiting_approval') ?? false;
          const contentNode = (
            <MessageBubble
              key={message.clientId ?? message.id}
              message={{ ...message, reasoning_content: undefined, toolItems: undefined, tool_calls: undefined }}
              showFooter={isFinalContent && !isLoading && message.id === latestAssistantMessageId}
              showFooterByDefault={message.id === latestAssistantMessageId}
              responseCurrent={isFinalContent ? currentIndex + 1 : undefined}
              responseTotal={isFinalContent ? attempts.length : undefined}
              onResponsePrev={isFinalContent && attempts.length > 1 ? () => onResponseNav(options.turnId, -1) : undefined}
              onResponseNext={isFinalContent && attempts.length > 1 ? () => onResponseNav(options.turnId, 1) : undefined}
              isGenerating={options.isActiveTurn && isFinalContent && !hasAwaitingApproval}
            />
          );
          if (isFinalContent) {
            finalNode = contentNode;
            foundFinalContent = true;
          } else {
            nodes.push(contentNode);
          }
        }

        for (const toolItem of message.toolItems ?? []) {
          if (isExplorationTool(toolItem)) {
            (foundFinalContent ? trailingExploration : exploration).push({ kind: 'tool', id: `tool-${toolItem.id}`, item: toolItem });
            continue;
          }
          flushExploration(foundFinalContent);
          if (shouldShowStandaloneTool(toolItem)) {
            (foundFinalContent ? trailingNodes : nodes).push(<ToolItemCard key={`standalone-${toolItem.id}`} item={toolItem} />);
          }
        }
      }
      flushExploration(false, true);
      flushExploration(true, true);
      return { intermediateNodes: nodes, finalNode, trailingNodes };
    };

    for (const group of groups) {
      if (group.kind === 'legacy') {
        const { message } = group;
        if (message.role === 'assistant' && isContextSummaryContent(message.content)) {
          const legacySummary = stripContextSummaryMarker(message.content);
          pushItem(<CompressionSeparator key={`comp-sep-legacy-${message.id}`} summary={legacySummary} />);
          continue;
        }
        if (message.role === 'user') {
          pushItem(<MessageBubble key={message.id} message={message} />);
        } else if (message.role === 'assistant') {
          const unitIndex = segmentMessageMap.get(message.id);
          const renderUnit = unitIndex !== undefined && !renderedUnits.has(unitIndex) ? renderUnits[unitIndex] : undefined;
          const trailingUnits: RenderUnit[] = [];
          const tailUnitIndexes = tailUnitsByMessageId.get(message.id) ?? [];
          for (const tailUnitIndex of tailUnitIndexes) {
            if (renderedUnits.has(tailUnitIndex)) continue;
            renderedUnits.add(tailUnitIndex);
            trailingUnits.push(renderUnits[tailUnitIndex]);
          }
          if (message.content || message.reasoning_content || renderUnit || trailingUnits.length > 0) {
            pushItem(
              <MessageBubble
                key={message.clientId ?? message.id}
                message={message}
                renderUnit={renderUnit}
                showFooterByDefault={message.id === latestAssistantMessageId}
                showFooter={message.id === latestAssistantMessageId}
                isGenerating={false}
                trailingUnits={trailingUnits}
              />,
            );
            if (renderUnit) renderedUnits.add(unitIndex!);
          }
          if (renderUnit && !renderedUnits.has(unitIndex!)) {
            renderedUnits.add(unitIndex!);
            pushItem(<RenderUnitView key={`ru-${unitIndex}`} unit={renderUnit} />);
          }
        }
        if (message.id === compactedToMessageId && summary) {
          pushItem(<CompressionSeparator key={`comp-sep-${message.id}`} summary={summary} />);
        }
        continue;
      }

      const { turnId } = group;
      maybeStartDismissal(turnId);
      const userMessage = group.messages.find((message) => message.role === 'user');
      const activeAttempt = activeForTurn(turnId);
      const turnAssistants = group.messages.filter(
        (message) => message.role === 'assistant' && message.attemptNo === activeAttempt,
      );
      const isActiveTurn = isLoading && turnId === lastTurnId;
      const finalAssistant = turnAssistants[turnAssistants.length - 1];

      if (userMessage) {
        const isLastUserMessage = userMessage.id === lastUserMessage?.id;
        const canEditUserMessage = isLastUserMessage && !isLoading;
        const turnChangeItems = !isActiveTurn ? turnAssistants.flatMap((message) => message.toolItems ?? []) : [];
        const cascadeUndoEntries = !isActiveTurn ? undoEntriesFromTurn(turnId) : [];
        pushItem(
          <MessageBubble
            key={userMessage.id}
            message={userMessage}
            onEditSubmit={canEditUserMessage ? onEditSubmit : undefined}
            isEditAvailable={canEditUserMessage}
            isConvLoading={isLoading}
            changeItems={turnChangeItems}
            onUndoChanges={cascadeUndoEntries.length > 0 ? () => onUndoCascade(turnId, cascadeUndoEntries) : undefined}
            undoConfirmationMessage="Undo all file changes made by replies from this message onward and delete those messages? Undo fails if any file was modified afterward."
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={onReasoningEffortChange}
          />,
        );
        if (userMessage.id === compactedToMessageId && summary) {
          pushItem(<CompressionSeparator key={`comp-sep-${userMessage.id}`} summary={summary} />);
        }
      }

      if (finalAssistant) {
        const { intermediateNodes, finalNode, trailingNodes } = buildTurnAssistantNodes(
          turnAssistants,
          { turnId, activeAttempt, isActiveTurn },
        );
        const timer = turnTimers[turnId];
        let durationMs: number | undefined;
        if (!isActiveTurn) {
          if (timer?.startedAt && timer.endedAt) {
            durationMs = timer.endedAt - timer.startedAt;
          } else {
            let firstStart: number | undefined;
            let lastEnd: number | undefined;
            let durationSum = 0;
            for (const message of turnAssistants) {
              const completedAt = message.completed_at ?? parseDbTimestamp(message.created_at);
              if (message.duration !== undefined) durationSum += message.duration;
              if (completedAt === undefined || message.duration === undefined) continue;
              const messageStart = completedAt - message.duration;
              if (firstStart === undefined || messageStart < firstStart) firstStart = messageStart;
              if (lastEnd === undefined || completedAt > lastEnd) lastEnd = completedAt;
            }
            if (firstStart !== undefined && lastEnd !== undefined && lastEnd > firstStart) {
              durationMs = lastEnd - firstStart;
            } else if (durationSum > 0) {
              durationMs = durationSum;
            }
          }
        }

        pushItem(
          <ProcessedSummary
            key={`processed-${turnId}`}
            isProcessing={isActiveTurn}
            startedAt={timer?.startedAt}
            durationMs={durationMs ?? 0}
            hasIntermediate={intermediateNodes.length > 0}
          >
            {intermediateNodes}
          </ProcessedSummary>,
        );
        if (finalNode) pushItem(finalNode);
        if (trailingNodes.length > 0) {
          pushItem(
            <div className="assistant-message-inset" key={`trailing-${turnId}`}>
              {trailingNodes}
            </div>,
          );
        }
      }

      if (
        compactedToMessageId &&
        summary &&
        userMessage?.id !== compactedToMessageId &&
        group.messages.some((message) => message.id === compactedToMessageId)
      ) {
        pushItem(<CompressionSeparator key={`comp-sep-${compactedToMessageId}`} summary={summary} />);
      }
    }

    if (dismissingItems.length > 0) {
      items.push(
        <div
          key={`undo-dissolve-${dismissingFromTurnId}`}
          className="flex flex-col gap-3 overflow-hidden pointer-events-none animate-[undo-dissolve_420ms_cubic-bezier(0.32,0.72,0,1)_forwards]"
          style={{ transformOrigin: 'top center' }}
        >
          {dismissingItems}
        </div>,
      );
    }

    return items;
  }, [
    conversationId,
    conversations,
    messages,
    activeAttempts,
    visibleMessages,
    renderUnits,
    segmentMessageMap,
    tailUnitsByMessageId,
    lastUserMessage,
    isLoading,
    turnTimers,
    reasoningEffort,
    onReasoningEffortChange,
    onEditSubmit,
    onResponseNav,
    onUndoCascade,
    dismissingFromTurnId,
  ]);

  return {
    chatItems,
    pendingApprovalItems,
  };
}
