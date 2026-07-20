import React, { useRef, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface MarkdownShadowDOMRendererProps {
  children: ReactNode;
  isGenerating?: boolean;
}

let cachedStyleText: string | null = null;

function collectStyleText(): string {
  if (cachedStyleText !== null) return cachedStyleText;
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      parts.push(Array.from(rules).map((r) => r.cssText).join('\n'));
    } catch {
      if (sheet.href) parts.push(`@import url('${sheet.href}');`);
    }
  }
  cachedStyleText = parts.join('\n');
  return cachedStyleText;
}

function buildCssVariableOverrides(): string {
  const computed = getComputedStyle(document.documentElement);
  const vars = [
    '--text-primary', '--text-secondary', '--text-tertiary',
    '--bg-subtle', '--bg-user-bubble',
    '--border', '--accent', '--link',
  ];
  const declarations: string[] = [];
  for (const v of vars) {
    const val = computed.getPropertyValue(v).trim();
    if (val) declarations.push(`${v}: ${val};`);
  }
  return declarations.length ? `:host { ${declarations.join(' ')} }` : '';
}

const MarkdownShadowDOMRenderer: React.FC<MarkdownShadowDOMRendererProps> = ({ children, isGenerating }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowContainer, setShadowContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      cachedStyleText = null;
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let shadow = host.shadowRoot;
    if (!shadow) {

      shadow = host.attachShadow({ mode: 'open' });

      const styleEl = document.createElement('style');
      styleEl.textContent = collectStyleText();
      shadow.appendChild(styleEl);

      const varStyle = document.createElement('style');
      varStyle.textContent = buildCssVariableOverrides();
      shadow.appendChild(varStyle);
    } else {

      const styleEl = shadow.querySelector('style');
      if (styleEl && cachedStyleText === null) {
        styleEl.textContent = collectStyleText();
      }
      const varStyle = shadow.querySelectorAll('style')[1];
      if (varStyle) {
        varStyle.textContent = buildCssVariableOverrides();
      }
    }

    const container = document.createElement('div');
    container.className = 'markdown-body organic-markdown';
    shadow.appendChild(container);
    setShadowContainer(container);

    return () => {

      container.remove();
      setShadowContainer(null);
    };
  }, []);

  useEffect(() => {
    if (shadowContainer) {
      if (isGenerating) {
        shadowContainer.classList.add('is-generating');
      } else {
        shadowContainer.classList.remove('is-generating');
      }
    }
  }, [shadowContainer, isGenerating]);

  return (
    <div ref={hostRef}>
      {shadowContainer && createPortal(children, shadowContainer)}
    </div>
  );
};

export default MarkdownShadowDOMRenderer;
