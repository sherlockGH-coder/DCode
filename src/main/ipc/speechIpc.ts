import { ipcMain } from 'electron';
import { IPC_EVENTS } from '../../shared/types';
import type { SpeechTranscriptionResult } from '../../shared/types';
import { transcribeSpeech } from '../speech/speechService';

export function registerSpeechIpc(): void {
  ipcMain.handle(
    IPC_EVENTS.SPEECH_TRANSCRIBE,
    async (_event, audioBuffer: ArrayBuffer | Uint8Array, mimeType: string): Promise<SpeechTranscriptionResult> => {
      if (typeof mimeType !== 'string') {
        throw new Error('录音格式参数无效');
      }
      return transcribeSpeech(audioBuffer, mimeType);
    },
  );
}
