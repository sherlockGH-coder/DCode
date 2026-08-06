import React from 'react';
import { IconCheck } from '../icons';
import type { ProviderModels } from '../../hooks/useModels';

type ReasoningEffort = 'high' | 'max' | undefined;

const ReasoningIcon: React.FC<{ effort: ReasoningEffort }> = ({ effort }) => {
  if (!effort) return null;
  if (effort === 'high') {
    return (
      <svg data-testid="model-selector-icon" width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor" className="shrink-0 text-accent">
        <path d="M503.306008 943.44652c-16.165136 0-31.740848-6.740504-42.680993-18.538178-10.886933-11.686133-16.208114-27.079698-15.027221-43.3707l19.127601-269.765487H210.028061c-22.189327 0-41.97696-12.415749-51.683-32.415206-9.775625-20.113043-7.24704-43.48224 6.516401-61.024743L491.691506 101.69085c21.784099-27.779638 66.585378-27.978159 89.057137-1.769293 10.924795 12.752416 15.533757 29.184634 12.946844 46.234929l-35.812575 234.458424h256.115633c21.459711 0 41.009937 11.881585 50.981013 30.952904 9.972099 19.1583 8.509797 42.078267-3.850694 59.801895L550.073054 918.671304c-10.923772 15.786513-27.975089 24.775217-46.767046 24.775216z m-0.310061-57.525043l0.310061 28.706752V885.864172c-0.112563 0-0.196474 0-0.310061 0.057305z m33.819179-748.474333L210.098669 553.908398l316.382108 0.280386-23.539065 331.450261 311.029204-447.162425-323.122613-0.251733 45.966823-300.777743z" />
      </svg>
    );
  }
  return (
    <svg data-testid="model-selector-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(90 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(150 12 12)" />
    </svg>
  );
};

const effortLabel = (effort: string | undefined): 'Off' | 'High' | 'Max' => {
  if (effort === 'high') return 'High';
  if (effort === 'max') return 'Max';
  return 'Off';
};

const ModelSelector: React.FC<{
  isWelcomeStyle: boolean;
  isOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  reasoningEffort?: string;
  isLoading: boolean;
  models: string[];
  selectedModel: string;
  selectedProvider: string;
  providers: ProviderModels[];
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onModelChange: (model: string, profileId?: string) => void;
  onReasoningEffortChange: (effort: string | undefined) => void;
}> = ({
  isWelcomeStyle,
  isOpen,
  menuRef,
  reasoningEffort,
  isLoading,
  models,
  selectedModel,
  selectedProvider,
  providers,
  onOpenChange,
  onModelChange,
  onReasoningEffortChange,
}) => {
  // hoveredProvider: profileId of the provider whose model submenu is shown
  const [hoveredProvider, setHoveredProvider] = React.useState<string | null>(null);
  // hoveredModel: model name whose effort submenu is shown
  const [hoveredModel, setHoveredModel] = React.useState<string | null>(null);
  const currentEffort = effortLabel(reasoningEffort);

  React.useEffect(() => {
    if (!isOpen) {
      setHoveredProvider(null);
      setHoveredModel(null);
    }
  }, [isOpen]);

  const closeMenu = () => {
    setHoveredProvider(null);
    setHoveredModel(null);
    onOpenChange(false);
  };

  // Find which provider is currently active (contains the selected model)
  const activeProviderForModel = providers.find((p) => p.isActive);

  // Display label: provider/model
  const displayLabel = selectedProvider && selectedModel
    ? `${selectedProvider}/${selectedModel}`
    : selectedModel || 'Loading...';

  // The hovered provider data
  const hoveredProviderData = providers.find((p) => p.profileId === hoveredProvider);

  return (
    <div className={`relative flex h-7 shrink-0 items-center ${isWelcomeStyle ? 'welcome-model-selector' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="inline-flex h-7 items-center justify-center gap-1 rounded-[7px] border-none bg-transparent px-2 text-[13px] font-normal text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
        onClick={() => onOpenChange(!isOpen)}
        disabled={isLoading || models.length === 0}
        aria-label="Select model"
        aria-expanded={isOpen}
      >
        <ReasoningIcon effort={reasoningEffort === 'max' ? 'max' : reasoningEffort === 'high' ? 'high' : undefined} />
        <span className="max-w-[90px] truncate leading-normal select-none xs:max-w-[140px] sm:max-w-[180px]">
          {displayLabel}
        </span>
        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-text-tertiary transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-testid="model-selector-menu"
          className="absolute bottom-full right-0 z-50 mb-1.5 overflow-visible"
          onMouseLeave={() => { setHoveredProvider(null); setHoveredModel(null); }}
        >
          {/* Level 1: Provider list */}
          <div className="w-[200px] overflow-hidden rounded-[12px] border border-hairline bg-bg-main p-1.5 shadow-floating animate-[menu-in_150ms_ease-out]">
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {providers.map((provider) => {
                const isActiveProvider = provider.profileId === activeProviderForModel?.profileId;
                const isHovered = hoveredProvider === provider.profileId;
                return (
                  <button
                    key={provider.profileId}
                    type="button"
                    aria-label={`Provider ${provider.providerName}`}
                    aria-expanded={isHovered}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] border-none px-2.5 text-left text-[13px] transition-colors ${isHovered ? 'bg-bg-hover' : 'bg-transparent hover:bg-bg-hover'}`}
                    onMouseEnter={() => { setHoveredProvider(provider.profileId); setHoveredModel(null); }}
                    onMouseOver={() => { setHoveredProvider(provider.profileId); setHoveredModel(null); }}
                    onFocus={() => setHoveredProvider(provider.profileId)}
                  >
                    <span className="min-w-0 truncate font-medium text-text-primary">{provider.providerName}</span>
                    <span className="ml-auto flex items-center justify-center w-[14px] shrink-0">
                      {isActiveProvider && <IconCheck size={14} className="text-text-secondary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level 2: Model list for hovered provider (opens to the LEFT of Level 1) */}
          {hoveredProviderData && (
            <div
              data-testid="model-submenu"
              className="absolute bottom-0 right-full mr-0.5 w-[200px] overflow-visible rounded-[12px] border border-hairline bg-bg-main p-1.5 shadow-floating animate-[menu-in_150ms_ease-out]"
              onMouseLeave={() => setHoveredModel(null)}
            >
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {hoveredProviderData.models.map((model) => {
                  const isSelected = model === selectedModel && hoveredProviderData.isActive;
                  const isModelHovered = hoveredModel === `${hoveredProviderData.profileId}:${model}`;
                  return (
                    <button
                      key={model}
                      type="button"
                      data-selected={isSelected}
                      className={`flex h-8 w-full items-center gap-2.5 rounded-[7px] border-none px-2.5 text-left text-[13px] transition-colors ${isSelected ? 'bg-accent-bg font-medium text-text-primary' : isModelHovered ? 'bg-bg-hover text-text-primary' : 'bg-transparent text-text-primary hover:bg-bg-hover'}`}
                      onMouseEnter={() => setHoveredModel(`${hoveredProviderData.profileId}:${model}`)}
                      onMouseOver={() => setHoveredModel(`${hoveredProviderData.profileId}:${model}`)}
                      onClick={() => {
                        onModelChange(model, hoveredProviderData.profileId);
                        closeMenu();
                      }}
                    >
                      <span className="min-w-0 truncate">{model}</span>
                      <span className="ml-auto flex items-center justify-center w-[14px] shrink-0">
                        {isSelected && <IconCheck size={14} className="text-text-secondary" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Level 3: Reasoning effort for hovered model (opens to the LEFT of Level 2) */}
              {hoveredModel && (
                <div
                  data-testid="effort-submenu"
                  className="absolute bottom-0 right-full mr-0.5 w-[160px] overflow-hidden rounded-[12px] border border-hairline bg-bg-main p-1.5 shadow-floating animate-[menu-in_150ms_ease-out]"
                >
                  <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium text-text-tertiary select-none">推理强度</p>
                  {([
                    ['Off', undefined],
                    ['High', 'high'],
                    ['Max', 'max'],
                  ] as const).map(([label, value]) => {
                    const selected = currentEffort === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        data-selected={selected}
                        className={`flex h-8 w-full items-center gap-2.5 rounded-[7px] border-none px-2.5 text-left text-[13px] transition-colors ${selected ? 'bg-accent-bg font-medium text-text-primary' : 'bg-transparent text-text-primary hover:bg-bg-hover'}`}
                        onClick={() => {
                          onReasoningEffortChange(value);
                          const parts = hoveredModel.split(':');
                          const profileId = parts[0];
                          const modelName = parts.slice(1).join(':');
                          onModelChange(modelName, profileId);
                          closeMenu();
                        }}
                      >
                        <span className="min-w-0 truncate">{label}</span>
                        <span className="ml-auto w-[14px] shrink-0 flex items-center justify-center">
                          {selected && <IconCheck size={14} className="text-text-secondary" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
