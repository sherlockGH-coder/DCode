import React from 'react';
import ModelListField from '../../controls/ModelListField';
import MaskedSecretInput from '../../controls/MaskedSecretInput';
import { IconChevronLeft, IconInfo } from '../../../icons';
import { Field } from './ProfileUi';
import { INPUT_CLASS, type DraftProfile, type SaveState } from './profileDraft';
import {
  PrimaryButton,
  SavePill,
  SecondaryButton,
  SectionTitle,
  SettingsGroup,
} from '../../SettingsPrimitives';

interface ProfileEditorProps {
  editing: DraftProfile;
  keyDraft: string;
  clearKey: boolean;
  saveState: SaveState;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onEditingChange: (next: DraftProfile) => void;
  onKeyDraftChange: (next: string) => void;
  onClearKeyChange: (next: boolean) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  editing,
  keyDraft,
  clearKey,
  saveState,
  error,
  onClose,
  onSave,
  onEditingChange,
  onKeyDraftChange,
  onClearKeyChange,
}) => {
  const updateEditing = (patch: Partial<DraftProfile>) => onEditingChange({ ...editing, ...patch });

  return (
    <div className="min-h-full pb-24">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SecondaryButton
            type="button"
            onClick={onClose}
            className="h-9 w-9 px-0"
            aria-label="返回配置列表"
          >
            <IconChevronLeft size={17} />
          </SecondaryButton>
          <div>
            <h2 className="text-[21px] font-semibold text-text-primary">编辑 API 配置</h2>
            <p className="mt-1 text-[12px] text-text-tertiary">端点、凭据与模型会一起保存到此配置。</p>
          </div>
        </div>
        <SavePill state={saveState} error={error} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {editing.protocol === 'legacy-openai' && (
            <div className="rounded-[12px] border border-amber-500/22 bg-amber-500/[0.09] p-4 text-amber-950 dark:text-amber-100">
              <div className="flex gap-3">
                <IconInfo size={17} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
                <div>
                  <h3 className="text-[13px] font-semibold">旧版 OpenAI 配置需要迁移</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-amber-900/75 dark:text-amber-100/70">
                    当前应用仅发送 Anthropic Messages 请求。请先把 Base URL 和模型改为支持该协议的值，再确认转换；原配置不会被自动改写或误调用。
                  </p>
                  <button
                    type="button"
                    onClick={() => updateEditing({ protocol: 'anthropic' })}
                    className="mt-3 inline-flex h-8 items-center rounded-[8px] bg-amber-600 px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
                  >
                    我已更新并确认 Anthropic 兼容
                  </button>
                </div>
              </div>
            </div>
          )}
          <SettingsGroup className="p-5">
            <SectionTitle>基础信息</SectionTitle>
            <div className="mt-4">
              <Field label="名称">
                <input
                  className={INPUT_CLASS}
                  value={editing.name}
                  onChange={(event) => updateEditing({ name: event.target.value })}
                  placeholder="例如 anyrouter"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Base URL" hint="填写服务根地址，不需要完整 chat endpoint。">
                <input
                  className={INPUT_CLASS}
                  value={editing.baseUrl}
                  onChange={(event) => updateEditing({ baseUrl: event.target.value })}
                  placeholder="https://api.example.com"
                />
              </Field>
            </div>
          </SettingsGroup>

          <SettingsGroup className="p-5">
            <SectionTitle>模型</SectionTitle>
            <div className="mt-4 space-y-4">
              <Field label="自定义模型" hint="提供商不支持 /v1/models 时，在这里手动添加模型；留空则自动拉取。">
                <ModelListField
                  models={editing.models}
                  defaultModel={editing.defaultModel}
                  onModelsChange={(models) => updateEditing({
                    models,
                    defaultModel: models.length > 0 && !models.includes(editing.defaultModel)
                      ? models[0]
                      : editing.defaultModel,
                  })}
                  onSetDefault={(model) => updateEditing({ defaultModel: model })}
                  placeholder="输入模型名后回车"
                />
              </Field>
              {editing.models.length === 0 && (
                <Field label="默认模型" hint="自定义模型为空时，新建对话默认使用的模型；留空则使用 Anthropic 协议的内置默认值。">
                  <input
                    className={INPUT_CLASS}
                    value={editing.defaultModel}
                    onChange={(event) => updateEditing({ defaultModel: event.target.value })}
                    placeholder="例如 claude-sonnet-4-6"
                  />
                </Field>
              )}
            </div>
          </SettingsGroup>
        </div>

        <SettingsGroup className="h-fit p-5">
          <SectionTitle>凭据</SectionTitle>
          <div className="mt-4">
            <Field
              label="API Key"
              hint={editing.apiKeySet ? '留空则保留当前 Key。输入新值会替换；勾选清除会删除当前 Key。' : '可先留空，后续再编辑补充。'}
            >
              <MaskedSecretInput
                className={INPUT_CLASS}
                type="password"
                value={keyDraft}
                configured={editing.apiKeySet && !clearKey}
                onValueChange={(next) => {
                  onKeyDraftChange(next);
                  onClearKeyChange(false);
                }}
                placeholder={editing.apiKeySet ? '输入新 Key 替换' : '请输入 API Key'}
              />
              {editing.apiKeySet && (
                <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={clearKey}
                    onChange={(event) => {
                      onClearKeyChange(event.target.checked);
                      if (event.target.checked) onKeyDraftChange('');
                    }}
                    className="rounded"
                  />
                  清除当前 API Key
                </label>
              )}
            </Field>
          </div>
        </SettingsGroup>
      </div>

      <div className="sticky bottom-0 mt-7 flex justify-end border-t border-hairline bg-bg-main py-4">
        <PrimaryButton
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
          className="h-9 px-5"
        >
          保存
        </PrimaryButton>
      </div>
    </div>
  );
};
