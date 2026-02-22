<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    onClose: () => void;
    maxWidth?: string;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    title,
    onClose,
    maxWidth = '480px',
    children,
    footer,
  }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
>
  <div
    class="modal-panel"
    style="max-width: {maxWidth};"
    role="dialog"
    aria-label={title}
  >
    <div class="modal-header">
      <h2 class="modal-title">{title}</h2>
      <button
        class="close-btn"
        onclick={onClose}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="modal-content">
      {@render children()}
    </div>

    {#if footer}
      <div class="modal-footer">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  }

  .modal-panel {
    width: 100%;
    margin: 0 16px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.08) 100%
    ), var(--glass-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--pad-btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px;
  }

  .modal-footer {
    flex-shrink: 0;
    padding: 12px 20px;
    border-top: 1px solid var(--glass-border);
  }
</style>
