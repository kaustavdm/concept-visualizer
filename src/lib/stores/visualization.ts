import { writable } from 'svelte/store';
import type { VisualizationSchema, VisualizationType } from '$lib/types';

interface VizState {
  current: VisualizationSchema | null;
  loading: boolean;
  error: string | null;
  vizType: VisualizationType | null;
  storyboardOrientation: 'horizontal' | 'vertical';
}

function createVisualizationStore() {
  const { subscribe, set, update } = writable<VizState>({
    current: null,
    loading: false,
    error: null,
    vizType: null,
    storyboardOrientation: 'horizontal'
  });

  function setLoading() {
    update(s => ({ ...s, loading: true, error: null }));
  }

  function setVisualization(viz: VisualizationSchema) {
    update(s => ({ ...s, current: viz, loading: false, error: null, vizType: viz.type }));
  }

  function setError(error: string) {
    update(s => ({ ...s, loading: false, error }));
  }

  function setVizType(type: VisualizationType) {
    update(s => ({
      ...s,
      vizType: type,
      current: s.current ? { ...s.current, type } : null
    }));
  }

  function setStoryboardOrientation(orientation: 'horizontal' | 'vertical') {
    update(s => ({
      ...s,
      storyboardOrientation: orientation,
      current: s.current ? {
        ...s.current,
        renderOptions: { ...s.current.renderOptions, orientation }
      } : null
    }));
  }

  function clear() {
    set({ current: null, loading: false, error: null, vizType: null, storyboardOrientation: 'horizontal' });
  }

  return { subscribe, setLoading, setVisualization, setError, setVizType, setStoryboardOrientation, clear };
}

export const vizStore = createVisualizationStore();
