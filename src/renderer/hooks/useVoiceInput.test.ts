import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceInput } from './useVoiceInput';

describe('useVoiceInput', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let current: ReturnType<typeof useVoiceInput> | undefined;
  let stopTrack: ReturnType<typeof vi.fn>;
  let closeAudioContext: ReturnType<typeof vi.fn>;
  let stopRecorder: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    stopTrack = vi.fn();
    closeAudioContext = vi.fn(async () => undefined);
    stopRecorder = vi.fn(function stop(this: { state: string }) {
      this.state = 'inactive';
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop = stopRecorder;
    }

    class MockAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 1,
          getByteTimeDomainData: (data: Uint8Array) => {
            data[0] = 128;
          },
        };
      }

      createMediaStreamSource() {
        return { connect: vi.fn() };
      }

      close = closeAudioContext;
    }

    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      Blob,
      AudioContext: MockAudioContext,
      MediaRecorder: MockMediaRecorder,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => ({
            getTracks: () => [{ stop: stopTrack }],
          })),
        },
      },
    });
    window.requestAnimationFrame = vi.fn(() => 1);
    window.cancelAnimationFrame = vi.fn();
    window.clearInterval = vi.fn();
    window.setInterval = vi.fn(() => 1 as any);
    (window as any).dcodeApi = {
      transcribeSpeech: vi.fn(async () => ({ text: 'hello' })),
    };

    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    current = undefined;
    vi.restoreAllMocks();
  });

  it('stops active recording resources when unmounted', async () => {
    const Harness = () => {
      current = useVoiceInput({ onTranscribed: vi.fn() });
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });
    await act(async () => {
      await current?.startRecording();
    });

    act(() => {
      root?.unmount();
    });

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closeAudioContext).toHaveBeenCalledTimes(1);
  });
});
