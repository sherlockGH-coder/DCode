export interface SpeechTranscribeInput {
  audio: Uint8Array;
  mimeType: string;
  language?: string;
}

export interface SpeechTranscribeOutput {
  text: string;
  durationMs: number;
}

export interface SpeechToTextProvider {
  transcribe(input: SpeechTranscribeInput): Promise<SpeechTranscribeOutput>;
}
