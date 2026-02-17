import { writable } from 'svelte/store';
import type { VisualizationSchema, VisualizationType } from '$lib/types';

interface VizState {
  current: VisualizationSchema | null;
  loading: boolean;
  error: string | null;
  vizType: VisualizationType | null;
}

function createVisualizationStore() {
  const { subscribe, set, update } = writable<VizState>({
    current: null,
    loading: false,
    error: null,
    vizType: null
  });

  function setLoading() {
    update(s => ({ ...s, loading: true, error: null }));
  }

  function setVisualization(viz: VisualizationSchema) {
    set({ current: viz, loading: false, error: null, vizType: viz.type });
  }

  function setError(error: string) {
    update(s => ({ ...s, loading: false, error }));
  }

  function setVizType(type: VisualizationType) {
    update(s => ({ ...s, vizType: type }));
  }

  function clear() {
    set({ current: null, loading: false, error: null, vizType: null });
  }

  return { subscribe, setLoading, setVisualization, setError, setVizType, clear };
}

export const vizStore = createVisualizationStore();
