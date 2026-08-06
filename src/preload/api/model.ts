import { ipcRenderer } from 'electron';
import type { SpeechTranscriptionResult } from '../../shared/types';

export const modelApi = {
  /** Get the available model list for active profile. */
  getModels: () => {
    return ipcRenderer.invoke('chat:getModels');
  },

  /** Get models grouped by provider for all enabled profiles. */
  getProviderModels: () => {
    return ipcRenderer.invoke('chat:getProviderModels');
  },

  transcribeSpeech: (audioBuffer: ArrayBuffer, mimeType: string): Promise<SpeechTranscriptionResult> => {
    return ipcRenderer.invoke('speech:transcribe', audioBuffer, mimeType);
  },
};
