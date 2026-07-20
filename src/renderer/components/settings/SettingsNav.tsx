import React from 'react';
import {
  IconChevronLeft,
  IconGear,
  IconGlobe,
  IconLayers,
  IconMicrophone,
  IconPanels,
  IconPlug,
  IconSearch,
  IconShield,
} from '../icons';

export type SettingsSection = 'appearance' | 'models' | 'speech' | 'search' | 'permissions' | 'skills' | 'mcp';

interface Props {
  active: SettingsSection;
  onSelect: (s: SettingsSection) => void;
  onClose?: () => void;
  isMacOS?: boolean;
  isFullscreen?: boolean;
}

type NavItem = { id: SettingsSection; label: string; Icon: React.FC<{ size?: number; className?: string }> };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: '个人',
    items: [
      { id: 'appearance', label: '外观', Icon: IconPanels },
      { id: 'models', label: '配置', Icon: IconGear },
      { id: 'speech', label: '语音输入', Icon: IconMicrophone },
      { id: 'search', label: '网络搜索', Icon: IconGlobe },
    ],
  },
  {
    title: '集成',
    items: [
      { id: 'skills', label: '技能', Icon: IconLayers },
      { id: 'mcp', label: 'MCP 服务器', Icon: IconPlug },
    ],
  },
  {
    title: '控制',
    items: [
      { id: 'permissions', label: '权限控制', Icon: IconShield },
    ],
  },
];

const SettingsNav: React.FC<Props> = ({
  active,
  onSelect,
  onClose,
  isMacOS = false,
  isFullscreen = false,
}) => {
  const showTrafficLightsSpacer = isMacOS && !isFullscreen;
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = React.useMemo(() => {
    if (!normalizedQuery) return NAV_GROUPS;
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  return (
    <nav
      className="shrink-0 flex flex-col min-h-0 overflow-hidden border-r border-black/[0.08] bg-[#F2F2F2] dark:border-white/[0.06] dark:bg-[#1C1C1E] [-webkit-app-region:drag] antialiased"
      style={{
        width: 240,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif'
      }}
    >
      {showTrafficLightsSpacer && <div className="h-[40px] shrink-0 w-full" />}

      <div className={`flex flex-col px-0 shrink-0 [-webkit-app-region:no-drag] ${showTrafficLightsSpacer ? 'pt-1.5' : 'pt-4'}`}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="group flex h-8 w-full items-center gap-2.5 rounded-[6px] bg-transparent px-2 text-[14px] font-semibold text-[#4B5058] transition-all duration-150 hover:bg-black/[0.04] hover:text-[#1D2127] dark:text-white/60 dark:hover:text-white/90"
          >
            <IconChevronLeft size={16} className="text-current transition-colors" />
            <span>返回应用</span>
          </button>
        )}
      </div>

      <div className="shrink-0 px-2.5 pt-2.5 [-webkit-app-region:no-drag]">
        <label className="relative block">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#9A9EA3]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索设置..."
            aria-label="搜索设置"
            className="h-8 w-full rounded-[6px] border border-black/[0.08] bg-white pl-8 pr-3 text-[14px] font-normal text-[#1D2127] outline-none transition-all placeholder:text-[#8E8E93] focus:border-black/[0.15] dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/35 dark:focus:bg-white/[0.11]"
          />
        </label>
      </div>

      <div className="sidebar-scroll flex-1 min-h-0 overflow-y-auto px-1 pb-6 pt-3.5 [-webkit-app-region:no-drag]">
        {filteredGroups.map((group) => (
          <div key={group.title} className="mt-5 first:mt-0">
            <p className="pl-2 pb-1 text-[14px] font-semibold text-[#8E8E93] select-none dark:text-white/40">
              {group.title}
            </p>
            <div className="flex flex-col gap-[2px]">
              {group.items.map(({ id, label, Icon }) => {
                const isSelected = active === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isSelected ? 'page' : undefined}
                    className={`group flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2 text-left text-[14px] font-normal transition-all duration-150 select-none ${
                      isSelected
                        ? 'bg-[#E4E5E7] text-[#1D2127] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-white/[0.12] dark:text-white'
                        : 'text-[#3A3A3C] hover:bg-black/[0.04] hover:text-[#111827] dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white'
                    }`}
                    onClick={() => onSelect(id)}
                  >
                    <Icon
                      size={16}
                      className={`shrink-0 transition-colors ${
                        isSelected
                          ? 'text-[#1D2127] dark:text-white'
                          : id === 'speech'
                            ? 'text-[#383D45] dark:text-white/90'
                            : 'text-[#5A606A] dark:text-white/65'
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="px-3 pt-8 text-[14px] font-medium text-[#9A9EA3] dark:text-white/38">
            没有匹配的设置项
          </div>
        )}
      </div>
    </nav>
  );
};

export default SettingsNav;
