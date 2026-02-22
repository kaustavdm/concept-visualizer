<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, keymap, placeholder } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap } from '@codemirror/commands';

  interface Props {
    onSubmit: (text: string) => void;
    activeMode?: string;
    disabled?: boolean;
    placeholderText?: string;
  }

  let { onSubmit, activeMode = 'graph', disabled = false, placeholderText = 'Describe a concept...' }: Props = $props();

  let containerEl: HTMLDivElement;
  let editorView: EditorView | undefined;

  function handleSubmit() {
    if (!editorView || disabled) return;
    const text = editorView.state.doc.toString().trim();
    if (!text) return;
    onSubmit(text);
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: '' },
    });
  }

  onMount(() => {
    const submitKeymap = keymap.of([{
      key: 'Enter',
      run: () => {
        handleSubmit();
        return true;
      },
    }]);

    const state = EditorState.create({
      doc: '',
      extensions: [
        submitKeymap,
        keymap.of(defaultKeymap),
        placeholder(placeholderText),
        EditorView.theme({
          '&': {
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            fontSize: '14px',
          },
          '.cm-content': {
            padding: '8px 0',
            caretColor: 'var(--accent)',
            fontFamily: "'Space Grotesk', sans-serif",
          },
          '.cm-line': {
            padding: '0',
          },
          '.cm-focused .cm-cursor': {
            borderLeftColor: 'var(--accent)',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-placeholder': {
            color: 'var(--text-primary)',
            opacity: '0.4',
          },
        }),
      ],
    });

    editorView = new EditorView({
      state,
      parent: containerEl,
    });
  });

  onDestroy(() => {
    editorView?.destroy();
  });
</script>

<div class="fixed bottom-[60px] left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
  <div
    class="flex items-center gap-2 rounded-xl px-3 py-1"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    "
  >
    <span
      class="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
      style="background: var(--accent); color: white;"
    >
      {activeMode}
    </span>

    <div bind:this={containerEl} class="flex-1 min-w-0"></div>

    <button
      onclick={handleSubmit}
      {disabled}
      class="shrink-0 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
      style="
        background: var(--accent);
        color: white;
        opacity: {disabled ? 0.5 : 1};
      "
      title="Send (Enter)"
    >
      Send
    </button>
  </div>
</div>
