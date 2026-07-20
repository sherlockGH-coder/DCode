import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { IconX, IconPlus } from './icons';
import { createTerminalLayout } from './terminalLayout';

/** 终端小图标 — 用于 Tab 标签 */
const IconTerminal: React.FC<{ size?: number; className?: string }> = ({
  size = 13,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

interface TerminalPanelProps {
  cwd: string | null;
  resizeTick?: number;
  visible: boolean;
  /** 关闭最后一个 tab 时触发，让父组件折叠底板 */
  onAllClosed?: () => void;
}

interface TabModel {
  id: string;
  sessionId: string;
  cwd: string;
  label: string;
}

const FONT_FAMILY = [
  '"MesloLGS NF"',
  '"JetBrainsMono Nerd Font"',
  '"FiraCode Nerd Font"',
  '"Hack Nerd Font"',
  '"Cascadia Code NF"',
  '"Sauce Code Pro Nerd Font"',
  '"Iosevka Nerd Font"',
  '"Symbols Nerd Font"',
  'Menlo',
  'Monaco',
  '"Courier New"',
  'monospace',
].join(', ');

interface ThemeColors {
  bg: string;
  textPrimary: string;
}

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const isDark = document.documentElement.classList.contains('dark');
  const get = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    bg: isDark ? '#000000' : '#ffffff',
    textPrimary: get('--text-primary', isDark ? '#cfcfd6' : '#1d1d1f'),
  };
}

function buildXtermTheme(c: ThemeColors, isDark: boolean) {
  return {
    background: c.bg,
    foreground: c.textPrimary,
    cursor: c.textPrimary,
    cursorAccent: c.bg,
    selectionBackground: isDark
      ? 'rgba(139,156,247,0.25)'
      : 'rgba(77,107,254,0.18)',
    black: isDark ? '#1a1a1e' : '#1d1d1f',
    red: isDark ? '#f06278' : '#c0392b',
    green: isDark ? '#6bde8a' : '#0f8a4f',
    yellow: isDark ? '#e0b860' : '#a07300',
    blue: isDark ? '#6baaff' : '#2472c8',
    magenta: isDark ? '#c792ea' : '#9c4dc7',
    cyan: isDark ? '#5ed5e8' : '#0c8aa8',
    white: isDark ? '#c8c8d4' : '#aeaeb2',
    brightBlack: isDark ? '#555562' : '#6e6e73',
    brightRed: isDark ? '#f4878e' : '#e74c3c',
    brightGreen: isDark ? '#7ec87b' : '#23a36a',
    brightYellow: isDark ? '#f0c860' : '#c08a00',
    brightBlue: isDark ? '#8eb8ff' : '#3b8eea',
    brightMagenta: isDark ? '#d8a8f2' : '#b561d8',
    brightCyan: isDark ? '#7ee5f2' : '#11a8cd',
    brightWhite: isDark ? '#e8e8f0' : '#1d1d1f',
  } as const;
}

function safeFitAndSync(sessionId: string, term: Terminal, fit: FitAddon, host: HTMLElement) {
  if (host.clientWidth <= 0 || host.clientHeight <= 0) return;
  try {
    const proposed = fit.proposeDimensions();
    if (!proposed) return;
    const layout = createTerminalLayout(proposed);
    if (term.cols !== layout.rendererCols || term.rows !== layout.rows) {
      term.resize(layout.rendererCols, layout.rows);
    }
    window.terminalApi.resize(sessionId, layout.ptyCols, layout.rows);
  } catch {

  }
}

interface TerminalViewProps {
  sessionId: string;
  active: boolean;
  visible: boolean;
  resizeTick?: number;
}

const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  active,
  visible,
  resizeTick,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    while (host.firstChild) host.removeChild(host.firstChild);

    const isDark = document.documentElement.classList.contains('dark');
    const themeColors = readThemeColors();
    const term = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: buildXtermTheme(themeColors, isDark),
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    let webgl: WebglAddon | null = null;
    try {
      webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl?.dispose();
        webgl = null;
      });
      term.loadAddon(webgl);
    } catch {
      webgl = null;
    }

    termRef.current = term;
    fitRef.current = fit;

    /* ---- 抹平所有 xterm 内层的背景色，消除右侧异色竖条 ---- */
    const wipeXtermBackgrounds = () => {
      if (!hostRef.current || !term.element) return;
      const xtermEl = term.element;
      const viewport = xtermEl.querySelector<HTMLElement>('.xterm-viewport');
      const screen = xtermEl.querySelector<HTMLElement>('.xterm-screen');
      const scrollArea = xtermEl.querySelector<HTMLElement>('.xterm-scroll-area');

      // 让终端区所有层透出外层 ide-terminal-body 的统一背景
      hostRef.current.style.backgroundColor = 'transparent';
      xtermEl.style.backgroundColor = 'transparent';
      if (screen) screen.style.backgroundColor = 'transparent';
      if (viewport) {
        viewport.style.backgroundColor = 'transparent';
      }
      if (scrollArea) scrollArea.style.backgroundColor = 'transparent';
    };
    wipeXtermBackgrounds();

    safeFitAndSync(sessionId, term, fit, host);

    let cancelled = false;
    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve();
    fontsReady.then(() => {
      if (cancelled || !hostRef.current || !termRef.current || !fitRef.current) return;
      safeFitAndSync(sessionId, termRef.current, fitRef.current, hostRef.current);
    });

    const offData = window.terminalApi.onData(sessionId, (data) => {
      term.write(data);
    });
    const offExit = window.terminalApi.onExit(sessionId, ({ exitCode }) => {
      term.write(`\r\n\x1b[2m[进程已退出 (code ${exitCode})]\x1b[0m\r\n`);
    });

    window.terminalApi.attach(sessionId).then(() => {
      if (cancelled || !hostRef.current) return;
      safeFitAndSync(sessionId, term, fit, hostRef.current);
    });

    const inputDisp = term.onData((data) => {
      window.terminalApi.write(sessionId, data);
    });

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || hostRef.current.offsetHeight === 0 || !termRef.current || !fitRef.current) {
        return;
      }
      safeFitAndSync(sessionId, termRef.current, fitRef.current, hostRef.current);
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      ro.disconnect();
      inputDisp.dispose();
      offData();
      offExit();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  /* 监听明暗主题切换，动态刷新终端配色 */
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const applyTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const c = readThemeColors();
      // 更新 xterm 主题
      term.options.theme = buildXtermTheme(c, isDark);
      // 同步外层 CSS 背景（xterm 内部层仍透出 CSS 背景）
      const viewport = term.element?.querySelector<HTMLElement>('.xterm-viewport');
      if (viewport) viewport.style.backgroundColor = 'transparent';
    };

    const mo = new MutationObserver(() => {
      applyTheme();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => mo.disconnect();
  }, [sessionId]);

  useEffect(() => {
    if (!active || !visible) return;
    const fit = fitRef.current;
    const term = termRef.current;
    const host = hostRef.current;
    if (!fit || !term || !host) return;
    const t = setTimeout(() => {
      safeFitAndSync(sessionId, term, fit, host);
      term.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [active, visible, resizeTick, sessionId]);

  return (
    <div
      className="ide-terminal-body w-full h-full box-border"
      style={{
        display: active ? 'block' : 'none',
        padding: '4px 4px 4px 4px',
      }}
      onMouseDown={() => termRef.current?.focus()}
    >
      <div ref={hostRef} className="w-full h-full overflow-hidden" />
    </div>
  );
};

const TerminalPanel: React.FC<TerminalPanelProps> = ({
  cwd,
  resizeTick,
  visible,
  onAllClosed,
}) => {
  const [tabs, setTabs] = useState<TabModel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;

  const onAllClosedRef = useRef(onAllClosed);
  onAllClosedRef.current = onAllClosed;

  const creatingRef = useRef(false);

  const addTab = useCallback(async () => {
    const sessionId = `term-${crypto.randomUUID()}`;
    try {
      const info = await window.terminalApi.create(sessionId, {
        cwd: cwdRef.current,
      });
      const newTab: TabModel = {
        id: crypto.randomUUID(),
        sessionId: info.sessionId,
        cwd: info.cwd,
        label: info.userLabel,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveId(newTab.id);
    } catch (err) {
      console.error('[TerminalPanel] 创建终端失败', err);
    }
  }, []);

  useEffect(() => {
    if (!visible || tabs.length > 0 || creatingRef.current) return;
    creatingRef.current = true;
    addTab().finally(() => {
      creatingRef.current = false;
    });
  }, [visible, tabs.length, addTab]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const target = prev[idx];
        window.terminalApi.kill(target.sessionId).catch(() => {});
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        setActiveId((curr) => {
          if (curr !== id) return curr;
          if (next.length === 0) return null;
          return next[Math.max(0, idx - 1)].id;
        });
        if (next.length === 0) {

          queueMicrotask(() => onAllClosedRef.current?.());
        }
        return next;
      });
    },
    [],
  );

  const closeAll = useCallback(() => {
    setTabs((prev) => {
      for (const t of prev) {
        window.terminalApi.kill(t.sessionId).catch(() => {});
      }
      return [];
    });
    setActiveId(null);
    queueMicrotask(() => onAllClosedRef.current?.());
  }, []);

  const tabBar = useMemo(
    () => (
      <div className="ide-tab-bar" role="tablist" aria-label="终端标签页">
        <div className="ide-tabs-scroll">
          {tabs.map((t) => {
            const isActive = t.id === activeId;
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(t.id)}
                title={t.cwd}
                className={`ide-tab${isActive ? ' active' : ''}`}
              >
                {/* 终端图标 */}
                <span className="ide-tab-icon">
                  <IconTerminal size={14} />
                </span>
                <span className="ide-tab-label">{t.label}</span>
                <span
                  className="ide-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  aria-label="关闭标签"
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>
        {/* 右侧操作按钮 */}
        <div className="ide-tab-actions">
          <button
            type="button"
            className="ide-tab-action"
            aria-label="新建终端"
            title="新建终端 (⌘T)"
            onClick={() => addTab()}
          >
            <IconPlus size={14} className="shrink-0 text-current" />
          </button>
          {tabs.length > 0 && (
            <button
              type="button"
              className="ide-tab-action"
              aria-label="关闭全部终端"
              title="关闭全部终端"
              onClick={closeAll}
            >
              <IconX size={14} className="shrink-0 text-current" />
            </button>
          )}
        </div>
      </div>
    ),
    [tabs, activeId, closeTab, closeAll, addTab],
  );

  return (
    <div className="flex flex-col h-full w-full ide-terminal-panel">
      {tabBar}
      <div className="flex-1 min-h-0 w-full relative">
        {tabs.map((t) => (
          <TerminalView
            key={t.id}
            sessionId={t.sessionId}
            active={t.id === activeId}
            visible={visible}
            resizeTick={resizeTick}
          />
        ))}
      </div>
    </div>
  );
};

export default TerminalPanel;
