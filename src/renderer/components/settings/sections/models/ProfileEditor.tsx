import React from 'react';
import ModelListField from '../../controls/ModelListField';
import MaskedSecretInput from '../../controls/MaskedSecretInput';
import { IconChevronLeft } from '../../../icons';
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
            aria-label="Back to profile list"
          >
            <IconChevronLeft size={17} />
          </SecondaryButton>
          <div>
            <h2 className="text-[21px] font-semibold text-text-primary">Edit API profile</h2>
            <p className="mt-1 text-[12px] text-text-tertiary">The endpoint, credentials, and models are saved together in this profile.</p>
          </div>
        </div>
        <SavePill state={saveState} error={error} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <SettingsGroup className="p-5">
            <SectionTitle>Basic information</SectionTitle>
            <div className="mt-4">
              <Field label="Name">
                <input
                  className={INPUT_CLASS}
                  value={editing.name}
                  onChange={(event) => updateEditing({ name: event.target.value })}
                  placeholder="For example, anyrouter"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Base URL" hint="Enter the service root URL; the full chat endpoint is not required.">
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
            <SectionTitle>Models</SectionTitle>
            <div className="mt-4 space-y-4">
              <Field label="Custom models" hint="Add models manually here when the provider does not support /v1/models; leave empty to load them automatically.">
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
                  placeholder="Enter a model name and press Enter"
                />
              </Field>
              {editing.models.length === 0 && (
                <Field label="Default model" hint="The model used for new conversations when the custom model list is empty; leave empty to use the selected protocol's default.">
                  <input
                    className={INPUT_CLASS}
                    value={editing.defaultModel}
                    onChange={(event) => updateEditing({ defaultModel: event.target.value })}
                    placeholder="For example, deepseek-v4-flash"
                  />
                </Field>
              )}
            </div>
          </SettingsGroup>
        </div>

        <SettingsGroup className="h-fit p-5">
          <SectionTitle>Credentials</SectionTitle>
          <div className="mt-4">
            <Field
              label="API Key"
              hint={editing.apiKeySet ? 'Leave empty to keep the current key. Enter a new value to replace it; select clear to delete the current key.' : 'You can leave this empty and add it later.'}
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
                placeholder={editing.apiKeySet ? 'Enter a new key to replace it' : 'Enter an API key'}
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
                  Clear current API key
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
          Save
        </PrimaryButton>
      </div>
    </div>
  );
};
