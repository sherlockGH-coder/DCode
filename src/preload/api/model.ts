import { ipcRenderer } from 'electron';
import type { SpeechTranscriptionResult } from '../../shared/types';

export const modelApi = {
  /** 获取可用模型列表 */
  getModels: () => {
    return ipcRenderer.invoke('chat:getModels');
  },

  transcribeSpeech: (audioBuffer: ArrayBuffer, mimeType: string): Promise<SpeechTranscriptionResult> => {
    return ipcRenderer.invoke('speech:transcribe', audioBuffer, mimeType);
  },
};
