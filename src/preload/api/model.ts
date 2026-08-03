import { ipcRenderer } from 'electron';
import type { SpeechTranscriptionResult } from '../../shared/types';

export const modelApi = {
  /** Get the available model list. */
  getModels: () => {
    return ipcRenderer.invoke('chat:getModels');
  },

  transcribeSpeech: (audioBuffer: ArrayBuffer, mimeType: string): Promise<SpeechTranscriptionResult> => {
    return ipcRenderer.invoke('speech:transcribe', audioBuffer, mimeType);
  },
};
