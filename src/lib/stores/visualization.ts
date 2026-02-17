import { writable } from 'svelte/store';
import type { VisualizationSchema } from '$lib/types';

interface VizState {
  current: VisualizationSchema | null;
  loading: boolean;
  error: string | null;
}

function createVisualizationStore() {
  const { subscribe, set, update } = writable<VizState>({
    current: null,
    loading: false,
    error: null
  });

  function setLoading() {
    update(s => ({ ...s, loading: true, error: null }));
  }

  function setVisualization(viz: VisualizationSchema) {
    set({ current: viz, loading: false, error: null });
  }

  function setError(error: string) {
    update(s => ({ ...s, loading: false, error }));
  }

  function clear() {
    set({ current: null, loading: false, error: null });
  }

  return { subscribe, setLoading, setVisualization, setError, clear };
}

export const vizStore = createVisualizationStore();
