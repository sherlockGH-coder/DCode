import React, { useRef, useEffect, useCallback, type ReactNode } from 'react';
import MessageBubble from './MessageBubble';
import type { Message } from '../../shared/types';

const BOTTOM_THRESHOLD_PX = 2;

interface ChatPanelProps {
  messages?: Message[];
  renderMessage?: (message: Message) => React.ReactNode;
  /** 扁平渲染模式：直接传入预构建的 ReactNode 列表 */
  items?: ReactNode[];
  /** 内容变化信号：仅在真实新增/切换内容时变化，用于控制自动追尾 */
  contentVersion?: string | number;
  /** 底部占位高度（px），用于适配不同高度的底部面板 */
  bottomPadding?: number;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  renderMessage,
  items,
  contentVersion,
  bottomPadding = 180,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const autoFollowRef = useRef(true);

  const lastScrollTop = useRef(0);

  const prevContentLengthRef = useRef(0);

  const rafRef = useRef<number | null>(null);
  const scrollbarRevealTimeoutRef = useRef<number | null>(null);

  const contentLength = items?.length ?? messages?.length ?? 0;
  const derivedContentVersion = contentVersion ?? contentLength;
  const panelClass = 'chat-panel custom-scrollbar flex-1 overflow-y-auto bg-transparent';
  const contentClass = 'mx-auto w-full max-w-[760px]';

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.classList.add('is-scrolling');
    if (scrollbarRevealTimeoutRef.current !== null) {
      window.clearTimeout(scrollbarRevealTimeoutRef.current);
    }
    scrollbarRevealTimeoutRef.current = window.setTimeout(() => {
      container.classList.remove('is-scrolling');
      scrollbarRevealTimeoutRef.current = null;
    }, 700);

    const st = container.scrollTop;
    const distanceToBottom = container.scrollHeight - st - container.clientHeight;
    const scrolledUp = st < lastScrollTop.current;
    lastScrollTop.current = st;
    if (scrolledUp) {
      autoFollowRef.current = false;
    } else if (distanceToBottom <= BOTTOM_THRESHOLD_PX) {
      autoFollowRef.current = true;
    }
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (event.deltaY < 0) autoFollowRef.current = false;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleScroll, handleWheel]);

  const stickToBottom = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      if (!autoFollowRef.current) return;
      container.scrollTop = container.scrollHeight;
      lastScrollTop.current = container.scrollTop;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollbarRevealTimeoutRef.current !== null) {
        window.clearTimeout(scrollbarRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    stickToBottom();
  }, [derivedContentVersion, stickToBottom]);

  useEffect(() => {
    const prev = prevContentLengthRef.current;
    prevContentLengthRef.current = contentLength;

    if (prev === 0 && contentLength > 0) {
      autoFollowRef.current = true;
      lastScrollTop.current = 0;
      stickToBottom();
    } else if (contentLength === 0) {
      autoFollowRef.current = true;
      lastScrollTop.current = 0;
    }
  }, [contentLength, stickToBottom]);

  if (items) {
    if (items.length === 0) {
      return (
        <div
          ref={scrollContainerRef}
          className={`${panelClass} py-5 px-4 md:px-8`}
          role="region"
          aria-label="对话内容"
          tabIndex={0}
        >
          <div className={`${contentClass} h-full flex flex-col items-center justify-center`} />
        </div>
      );
    }
    return (
      <div
        ref={scrollContainerRef}
        className={`${panelClass} pt-6 pb-4 px-4 md:px-8`}
        role="region"
        aria-label="对话内容"
        tabIndex={0}
      >
        <div className={`${contentClass} flex flex-col gap-3`}>
          {items}
          <div style={{ height: bottomPadding, flexShrink: 0 }} />

        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div
        ref={scrollContainerRef}
        className={`${panelClass} pt-6 pb-4 px-4 md:px-8`}
        role="region"
        aria-label="对话内容"
        tabIndex={0}
      >
        <div className={`${contentClass} h-full flex flex-col items-center justify-center`} />
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`${panelClass} pt-6 pb-4 px-4 md:px-8`}
      role="region"
      aria-label="对话内容"
      tabIndex={0}
    >
      <div className={contentClass}>
        {messages.map((msg) => {
          if (renderMessage) {
            const custom = renderMessage(msg);
            if (custom) return custom;
          }
          return <MessageBubble key={msg.id} message={msg} />;
        })}
        <div style={{ height: bottomPadding, flexShrink: 0 }} />

      </div>
    </div>
  );
};

export default ChatPanel;
