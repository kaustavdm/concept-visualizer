import { writable, get } from 'svelte/store';

interface FocusState {
  focusedNodeId: string | null;
  zoomLevel: number;
  nodeIds: string[];
}

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

function createFocusStore() {
  const { subscribe, set, update } = writable<FocusState>({
    focusedNodeId: null,
    zoomLevel: 1,
    nodeIds: []
  });

  function focusNode(id: string) {
    update(s => ({ ...s, focusedNodeId: id }));
  }

  function clear() {
    set({ focusedNodeId: null, zoomLevel: 1, nodeIds: [] });
  }

  function setNodeIds(ids: string[]) {
    update(s => ({ ...s, nodeIds: ids }));
  }

  function zoomIn() {
    update(s => ({
      ...s,
      zoomLevel: Math.min(ZOOM_MAX, Math.round((s.zoomLevel + ZOOM_STEP) * 100) / 100)
    }));
  }

  function zoomOut() {
    update(s => ({
      ...s,
      zoomLevel: Math.max(ZOOM_MIN, Math.round((s.zoomLevel - ZOOM_STEP) * 100) / 100)
    }));
  }

  function fitToScreen() {
    update(s => ({ ...s, zoomLevel: 1, focusedNodeId: null }));
  }

  function focusNext() {
    update(s => {
      if (s.nodeIds.length === 0) return s;
      if (s.focusedNodeId === null) {
        return { ...s, focusedNodeId: s.nodeIds[0] };
      }
      const idx = s.nodeIds.indexOf(s.focusedNodeId);
      const nextIdx = (idx + 1) % s.nodeIds.length;
      return { ...s, focusedNodeId: s.nodeIds[nextIdx] };
    });
  }

  function focusPrev() {
    update(s => {
      if (s.nodeIds.length === 0) return s;
      if (s.focusedNodeId === null) {
        return { ...s, focusedNodeId: s.nodeIds[s.nodeIds.length - 1] };
      }
      const idx = s.nodeIds.indexOf(s.focusedNodeId);
      const prevIdx = (idx - 1 + s.nodeIds.length) % s.nodeIds.length;
      return { ...s, focusedNodeId: s.nodeIds[prevIdx] };
    });
  }

  return {
    subscribe,
    focusNode,
    clear,
    setNodeIds,
    zoomIn,
    zoomOut,
    fitToScreen,
    focusNext,
    focusPrev
  };
}

export const focusStore = createFocusStore();
