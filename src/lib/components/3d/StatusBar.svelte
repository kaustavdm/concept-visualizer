<script lang="ts">
  import type { CameraMode } from '$lib/3d/createScene';
  import { fpsToColor } from '$lib/3d/fps-color';

  interface StatusBarConfig {
    fps: boolean;
    mode: boolean;
    movement: boolean;
    filename: boolean;
    bar: boolean;
  }

  interface Props {
    mode: 'command' | 'input';
    cameraMode: CameraMode;
    voiceRecording: boolean;
    activeFileName: string | null;
    fps?: number;
    config?: StatusBarConfig;
  }

  let {
    mode,
    cameraMode,
    voiceRecording,
    activeFileName,
    fps = 0,
    config = { fps: false, mode: true, movement: true, filename: true, bar: true },
  }: Props = $props();

  let fpsStyle = $derived.by(() => {
    const { color, glow } = fpsToColor(fps);
    return {
      color,
      textShadow: glow ? `0 0 6px ${color}` : 'none',
    };
  });
</script>

{#if config.bar}
<div class="status-bar">
  <div class="status-left">
    {#if config.mode}
      <span
        class="mode-badge"
        class:mode-command={mode === 'command'}
        class:mode-input={mode === 'input'}
      >
        {mode === 'command' ? 'COMMAND' : 'INPUT'}
      </span>
    {/if}
    {#if config.movement}
      <span class="camera-label">{cameraMode.toUpperCase()}</span>
    {/if}
    {#if config.fps}
      <span
        class="fps-label"
        style="color: {fpsStyle.color}; text-shadow: {fpsStyle.textShadow};"
      >FPS: {fps}</span>
    {/if}
  </div>

  <div class="status-right">
    {#if voiceRecording}
      <span class="mic-indicator">MIC</span>
    {/if}
    {#if config.filename && activeFileName}
      <span class="file-name">{activeFileName}</span>
    {/if}
  </div>
</div>
{/if}

<style>
  .status-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 28px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--glass-border);
    font-family: var(--font-main);
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mode-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 3px;
    line-height: 1.4;
  }

  .mode-command {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.12);
  }

  .mode-input {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.12);
  }

  .camera-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mic-indicator {
    font-size: 10px;
    font-weight: 700;
    color: #ef4444;
    animation: mic-pulse 1.2s ease-in-out infinite;
  }

  @keyframes mic-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .file-name {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .fps-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    transition: color 0.3s;
  }
</style>
