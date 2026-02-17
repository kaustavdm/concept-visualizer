<script lang="ts">
  import { exportPdf } from '$lib/export/pdf';
  import { exportMarkdown } from '$lib/export/markdown';
  import type { ConceptFile } from '$lib/types';

  interface Props {
    file: ConceptFile | undefined;
  }

  let { file }: Props = $props();
  let open = $state(false);

  function handlePdf() {
    if (file) exportPdf(file);
    open = false;
  }

  async function handleMarkdown() {
    if (file) await exportMarkdown(file);
    open = false;
  }
</script>

<div class="relative">
  <button
    onclick={() => open = !open}
    disabled={!file?.visualization}
    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  >
    Export
  </button>

  {#if open}
    <div class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
      <button onclick={handlePdf} class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
        PDF
      </button>
      <button onclick={handleMarkdown} class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
        Markdown + Images
      </button>
    </div>
  {/if}
</div>
