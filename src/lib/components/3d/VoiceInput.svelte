<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
    disabled?: boolean;
  }

  let { onTranscript, onInterim, disabled = false }: Props = $props();

  let supported = $state(false);
  let recording = $state(false);
  let errorTip = $state('');

  // Web Speech API isn't in TS DOM lib — use loosely typed handle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null;
  /** true when user explicitly clicked stop — distinguishes from Chrome killing the session */
  let userStopped = false;
  let errorTipTimer: ReturnType<typeof setTimeout> | undefined;

  const ERROR_MESSAGES: Record<string, string> = {
    'network': 'Network error — check connection',
    'no-speech': 'No speech detected',
    'audio-capture': 'Microphone not available',
    'not-allowed': 'Microphone permission denied',
    'service-not-allowed': 'Speech service not available',
  };

  function showErrorTip(msg: string) {
    errorTip = msg;
    clearTimeout(errorTipTimer);
    errorTipTimer = setTimeout(() => { errorTip = ''; }, 3000);
  }

  onMount(() => {
    // Feature-detect SpeechRecognition (standard + webkit prefix)
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    supported = true;

    const rec = new (SpeechRecognitionCtor as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    })();

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim && onInterim) {
        onInterim(interim);
      }

      if (finalText) {
        onTranscript(finalText);
      }
    };

    rec.onerror = (event) => {
      // 'aborted' fires when we call stop() — not an actual error
      if (event.error === 'aborted') return;

      const msg = ERROR_MESSAGES[event.error] ?? `Speech error: ${event.error}`;
      console.warn('SpeechRecognition error:', event.error);
      showErrorTip(msg);
      recording = false;
      userStopped = true; // prevent auto-restart after error
    };

    rec.onend = () => {
      // Chrome kills continuous sessions after silence. Auto-restart if user hasn't stopped.
      if (recording && !userStopped) {
        try {
          rec.start();
          return;
        } catch {
          // start() can throw if called too soon — fall through to stop
        }
      }
      recording = false;
    };

    recognition = rec;

    return () => {
      clearTimeout(errorTipTimer);
      if (recording && recognition) {
        recognition.stop();
      }
      recognition = null;
    };
  });

  function toggle() {
    if (!recognition || disabled) return;

    if (recording) {
      userStopped = true;
      recognition.stop();
      recording = false;
    } else {
      userStopped = false;
      errorTip = '';
      try {
        recognition.start();
        recording = true;
      } catch (e) {
        showErrorTip('Could not start recording');
        console.warn('SpeechRecognition start failed:', e);
      }
    }
  }
</script>

{#if supported}
  <button
    class="voice-btn"
    class:recording
    class:has-error={!!errorTip}
    onclick={toggle}
    {disabled}
    aria-label={recording ? 'Stop voice recording' : 'Start voice recording'}
    title={errorTip || (recording ? 'Stop recording' : 'Voice input')}
  >
    {#if recording}
      <!-- Stop icon (square) -->
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
      </svg>
    {:else}
      <!-- Mic icon -->
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
          fill="currentColor"
        />
        <path
          d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2Z"
          fill="currentColor"
        />
      </svg>
    {/if}
  </button>
{/if}

<style>
  .voice-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s, border-color 0.15s;
    padding: 0;
  }

  .voice-btn:hover:not(:disabled) {
    background: var(--pad-btn-bg-hover);
  }

  .voice-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .voice-btn.recording {
    color: #ef4444;
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
    animation: pulse-recording 1.5s ease-in-out infinite;
  }

  .voice-btn.has-error {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  @keyframes pulse-recording {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
    }
  }
</style>
