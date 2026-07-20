import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

const DEFAULT_MAX_DURATION_MS = 60_000;
const LEVEL_SMOOTHING = 0.82;
const ANALYSER_FFT_SIZE = 256;
const RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

export type VoiceInputStatus = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

interface UseVoiceInputOptions {
  maxDurationMs?: number;
  onTranscribed: (text: string) => void;
}

interface UseVoiceInputResult {
  status: VoiceInputStatus;
  errorMessage: string | null;
  elapsedMs: number;
  level: number;
  isBusy: boolean;
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
  cancelRecording: () => void;
  resetError: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const transcribedRef = useRef(options.onTranscribed);

  useEffect(() => {
    transcribedRef.current = options.onTranscribed;
  }, [options.onTranscribed]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setLevel(0);
  }, []);

  const cleanupCapture = useCallback(() => {
    clearTimer();
    stopMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, [clearTimer, stopMeter]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setStatus('transcribing');
    clearTimer();
    stopMeter();

    try {
      const blob = await stopRecorder(recorder, () => chunksRef.current);
      mediaRecorderRef.current = null;
      cleanupCapture();

      const audioBuffer = await blob.arrayBuffer();
      const result = await window.dcodeApi.transcribeSpeech(audioBuffer, blob.type);
      transcribedRef.current(result.text);
      setElapsedMs(0);
      setErrorMessage(null);
      setStatus('idle');
    } catch (error) {
      cleanupCapture();
      mediaRecorderRef.current = null;
      setStatus('error');
      setErrorMessage(errorToMessage(error));
    } finally {
      chunksRef.current = [];
    }
  }, [cleanupCapture, clearTimer, stopMeter]);

  const startRecording = useCallback(async () => {
    if (status === 'requesting' || status === 'recording' || status === 'transcribing') return;

    setStatus('requesting');
    setErrorMessage(null);
    setElapsedMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current = [...chunksRef.current, event.data];
      };

      startedAtRef.current = Date.now();
      recorder.start(500);
      startLevelMeter(stream, audioContextRef, animationFrameRef, setLevel);
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Date.now() - startedAtRef.current;
        setElapsedMs(nextElapsed);
        if (nextElapsed >= maxDurationMs) void stopAndTranscribe();
      }, 200);
      setStatus('recording');
    } catch (error) {
      cleanupCapture();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setStatus('error');
      setErrorMessage(errorToMessage(error));
    }
  }, [cleanupCapture, maxDurationMs, status, stopAndTranscribe]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    cleanupCapture();
    setElapsedMs(0);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupCapture]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      cleanupCapture();
    };
  }, [cleanupCapture]);

  return {
    status,
    errorMessage,
    elapsedMs,
    level,
    isBusy: status === 'requesting' || status === 'transcribing',
    isRecording: status === 'recording',
    startRecording,
    stopAndTranscribe,
    cancelRecording,
    resetError: () => {
      setErrorMessage(null);
      setStatus('idle');
    },
  };
}

function getSupportedRecordingMimeType(): string {
  return RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function startLevelMeter(
  stream: MediaStream,
  audioContextRef: MutableRefObject<AudioContext | null>,
  animationFrameRef: MutableRefObject<number | null>,
  setLevel: (level: number) => void,
): void {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  let smoothedLevel = 0;

  analyser.fftSize = ANALYSER_FFT_SIZE;
  const data = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  audioContextRef.current = audioContext;

  const tick = () => {
    analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, value) => {
      const centered = (value - 128) / 128;
      return sum + centered * centered;
    }, 0) / data.length);
    smoothedLevel = smoothedLevel * LEVEL_SMOOTHING + rms * (1 - LEVEL_SMOOTHING);
    setLevel(Math.min(1, smoothedLevel * 7));
    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  tick();
}

function stopRecorder(recorder: MediaRecorder, getChunks: () => BlobPart[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = recorder.mimeType || 'audio/webm';
    recorder.onerror = () => reject(new Error('录音失败'));
    recorder.onstop = () => resolve(new Blob(getChunks(), { type: mimeType }));
    recorder.stop();
  });
}

function errorToMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return '麦克风权限被拒绝';
    if (error.name === 'NotFoundError') return '未找到可用麦克风';
    if (error.name === 'NotReadableError') return '麦克风正被其他应用占用';
  }
  if (error instanceof Error) return error.message;
  return '语音输入失败';
}
