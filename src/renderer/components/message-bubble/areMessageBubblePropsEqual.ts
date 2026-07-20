import type { MessageBubbleProps } from '../MessageBubble';

export function areMessageBubblePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.message === next.message &&
      prev.responseCurrent === next.responseCurrent && prev.responseTotal === next.responseTotal &&
      prev.renderUnit === next.renderUnit && prev.showFooter === next.showFooter &&
      prev.showFooterByDefault === next.showFooterByDefault &&
      prev.isGenerating === next.isGenerating && prev.hideReasoning === next.hideReasoning &&
      prev.trailingUnits === next.trailingUnits &&
      prev.changeItems === next.changeItems &&
      prev.onUndoChanges === next.onUndoChanges &&
      prev.undoConfirmationMessage === next.undoConfirmationMessage &&
      prev.onEditSubmit === next.onEditSubmit &&
      prev.isEditAvailable === next.isEditAvailable &&
      prev.isConvLoading === next.isConvLoading &&
      prev.reasoningEffort === next.reasoningEffort &&
      prev.onReasoningEffortChange === next.onReasoningEffortChange) return true;
  const a = prev.message;
  const b = next.message;
  return (
    a.id === b.id &&
    a.role === b.role &&
    a.content === b.content &&
    a.metadata === b.metadata &&
    a.reasoning_content === b.reasoning_content &&
    a.attachments === b.attachments &&
    a.duration === b.duration &&
    a.completed_at === b.completed_at &&
    a.created_at === b.created_at &&
    prev.responseCurrent === next.responseCurrent &&
    prev.responseTotal === next.responseTotal &&
    prev.renderUnit === next.renderUnit &&
    prev.showFooter === next.showFooter &&
    prev.showFooterByDefault === next.showFooterByDefault &&
    prev.isGenerating === next.isGenerating &&
    prev.hideReasoning === next.hideReasoning &&
    prev.trailingUnits === next.trailingUnits &&
    prev.changeItems === next.changeItems &&
    prev.onUndoChanges === next.onUndoChanges &&
    prev.undoConfirmationMessage === next.undoConfirmationMessage &&
    prev.onEditSubmit === next.onEditSubmit &&
    prev.isEditAvailable === next.isEditAvailable &&
    prev.isConvLoading === next.isConvLoading &&
    prev.reasoningEffort === next.reasoningEffort &&
    prev.onReasoningEffortChange === next.onReasoningEffortChange
  );
}
