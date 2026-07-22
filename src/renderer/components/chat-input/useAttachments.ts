import { useCallback, useEffect, useMemo, useState, type ClipboardEvent, type DragEvent } from 'react';
import type { Attachment } from '../../../shared/types';
import { ABS_PATH_RE } from './utils';

export function useChatInputAttachments({
  initialAttachments,
  isLoading,
}: {
  initialAttachments?: Attachment[];
  isLoading: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(() => initialAttachments ?? []);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    setAttachments(initialAttachments ?? []);
  }, [initialAttachments]);

  const addAttachments = useCallback((newOnes: Attachment[]) => {
    if (newOnes.length === 0) return;
    setAttachments((prev) => {
      const existing = new Set(prev.map((a) => a.path));
      const merged = [...prev];
      for (const attachment of newOnes) {
        if (!existing.has(attachment.path)) merged.push(attachment);
      }
      return merged;
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const handlePickFiles = useCallback(async () => {
    if (isLoading) return;
    try {
      const picked = await window.deepseekApi.pickFiles();
      addAttachments(picked);
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  }, [isLoading, addAttachments]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const results = await Promise.all(
      files.map((file) => {
        const path = (file as unknown as { path?: string }).path;
        return path ? window.deepseekApi.statPath(path) : Promise.resolve(null);
      }),
    );
    addAttachments(results.filter((attachment): attachment is Attachment => attachment !== null));
  }, [addAttachments]);

  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      try {
        const attachment = await window.deepseekApi.pasteClipboardImage();
        if (attachment) addAttachments([attachment]);
      } catch (err) {
        console.error('粘贴图片失败:', err);
      }
      return;
    }

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed.includes('\n') && ABS_PATH_RE.test(trimmed)) {
      const stat = await window.deepseekApi.statPath(trimmed);
      if (stat) {
        e.preventDefault();
        addAttachments([stat]);
      }
    }
  }, [addAttachments]);

  const imageAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.kind === 'image'),
    [attachments],
  );
  const fileAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.kind !== 'image'),
    [attachments],
  );

  return {
    attachments,
    isDraggingOver,
    imageAttachments,
    fileAttachments,
    clearAttachments,
    removeAttachment,
    handlePickFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  };
}
