import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { focusStore } from './focus';

describe('focusStore', () => {
  beforeEach(() => {
    focusStore.clear();
  });

  it('should start with no focused node', () => {
    const state = get(focusStore);
    expect(state.focusedNodeId).toBeNull();
    expect(state.zoomLevel).toBe(1);
  });

  it('should focus a node', () => {
    focusStore.focusNode('node-a');
    const state = get(focusStore);
    expect(state.focusedNodeId).toBe('node-a');
  });

  it('should clear focus', () => {
    focusStore.focusNode('node-a');
    focusStore.clear();
    const state = get(focusStore);
    expect(state.focusedNodeId).toBeNull();
  });

  it('should zoom in and out', () => {
    focusStore.zoomIn();
    expect(get(focusStore).zoomLevel).toBeGreaterThan(1);
    focusStore.zoomOut();
    focusStore.zoomOut();
    expect(get(focusStore).zoomLevel).toBeLessThan(1);
  });

  it('should clamp zoom between 0.3 and 3', () => {
    for (let i = 0; i < 20; i++) focusStore.zoomIn();
    expect(get(focusStore).zoomLevel).toBe(3);
    for (let i = 0; i < 40; i++) focusStore.zoomOut();
    expect(get(focusStore).zoomLevel).toBe(0.3);
  });

  it('should reset zoom on fitToScreen', () => {
    focusStore.zoomIn();
    focusStore.zoomIn();
    focusStore.fitToScreen();
    const state = get(focusStore);
    expect(state.zoomLevel).toBe(1);
    expect(state.focusedNodeId).toBeNull();
  });

  it('should navigate to next and previous node', () => {
    const nodeIds = ['a', 'b', 'c'];
    focusStore.setNodeIds(nodeIds);
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('a');
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('b');
    focusStore.focusPrev();
    expect(get(focusStore).focusedNodeId).toBe('a');
  });

  it('should wrap around on next/prev', () => {
    focusStore.setNodeIds(['a', 'b']);
    focusStore.focusNode('b');
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('a');
  });
});
