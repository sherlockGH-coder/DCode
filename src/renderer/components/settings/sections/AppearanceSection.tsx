import React from 'react';
import { getThemePreference, setThemePreference, type ThemePreference } from '../../../themePreference';
import { SettingsPageHeader, SectionTitle } from '../SettingsPrimitives';

const OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'system', label: '跟随系统', description: '自动匹配系统的外观设置' },
  { value: 'light', label: '浅色', description: '始终使用清晰明亮的浅色界面' },
  { value: 'dark', label: '深色', description: '始终使用适合低光环境的深色界面' },
];

const ThemePreview: React.FC<{ theme: ThemePreference }> = ({ theme }) => {
  const dark = theme === 'dark';
  return (
    <div className={`h-[92px] overflow-hidden rounded-[9px] border p-2 ${dark ? 'border-white/10 bg-[#1e1e20]' : theme === 'system' ? 'border-black/10 bg-gradient-to-br from-white from-50% to-[#242428] to-50%' : 'border-black/10 bg-white'}`}>
      <div className={`flex h-full gap-1.5 rounded-[6px] p-1.5 ${dark ? 'bg-[#29292d]' : 'bg-[#eef0f3]'}`}>
        <div className={`w-[30%] rounded-[4px] ${dark ? 'bg-[#3a3a40]' : 'bg-white'}`} />
        <div className={`flex flex-1 flex-col justify-end rounded-[4px] p-1.5 ${dark ? 'bg-[#242428]' : 'bg-white'}`}>
          <div className={`h-2 w-3/4 rounded-full ${dark ? 'bg-white/20' : 'bg-black/15'}`} />
          <div className="mt-1.5 h-2 w-1/2 rounded-full bg-accent/70" />
        </div>
      </div>
    </div>
  );
};

const AppearanceSection: React.FC = () => {
  const [preference, setPreference] = React.useState<ThemePreference>(() => getThemePreference());

  const selectTheme = (value: ThemePreference) => {
    setPreference(value);
    setThemePreference(value);
  };

  return (
    <>
      <SettingsPageHeader title="外观" description="选择应用界面的主题；更改会立即生效" />
      <SectionTitle>主题</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="应用主题">
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectTheme(option.value)}
              className={`rounded-[12px] border p-2.5 text-left transition-colors ${selected ? 'border-accent bg-accent-bg ring-2 ring-accent/10' : 'border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-[#1e1e20] dark:hover:border-white/20'}`}
            >
              <ThemePreview theme={option.value} />
              <div className="mt-3 flex items-center gap-2 px-0.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-accent bg-accent' : 'border-black/25 dark:border-white/30'}`}>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-[13.5px] font-semibold text-text-primary">{option.label}</span>
              </div>
              <p className="mt-1.5 min-h-[36px] px-0.5 text-[12px] leading-[18px] text-text-secondary">{option.description}</p>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default AppearanceSection;
