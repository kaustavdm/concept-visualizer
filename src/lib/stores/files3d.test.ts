import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { files3dStore } from './files3d';
import { db } from '$lib/db';

describe('files3dStore', () => {
  beforeEach(async () => {
    await db.files3d.clear();
    await files3dStore.init();
  });

  it('should start with empty state', () => {
    const state = get(files3dStore);
    expect(state.files).toEqual([]);
    expect(state.activeFileId).toBeNull();
  });

  it('should create a new File3d with default layer', async () => {
    const file = await files3dStore.create('Test 3D Scene');
    expect(file.title).toBe('Test 3D Scene');
    expect(file.layers).toHaveLength(1);
    expect(file.layers[0].name).toBe('Layer 1');
    expect(file.layers[0].visible).toBe(true);
    expect(file.layers[0].text).toBe('');
    expect(file.layers[0].entities).toEqual([]);
    expect(file.layers[0].order).toBe(0);
    expect(file.theme).toBe('light');

    const state = get(files3dStore);
    expect(state.activeFileId).toBe(file.id);
    expect(state.files).toHaveLength(1);

    // Verify persistence
    const persisted = await db.files3d.get(file.id);
    expect(persisted?.title).toBe('Test 3D Scene');
    expect(persisted?.layers).toHaveLength(1);
  });

  it('should delete a file', async () => {
    const file = await files3dStore.create('To Delete');
    await files3dStore.remove(file.id);

    const state = get(files3dStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();

    // Verify persistence
    const persisted = await db.files3d.get(file.id);
    expect(persisted).toBeUndefined();
  });

  it('should rename a file', async () => {
    const file = await files3dStore.create('Old Name');
    await files3dStore.rename(file.id, 'New Name');

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.title).toBe('New Name');

    // Verify persistence
    const persisted = await db.files3d.get(file.id);
    expect(persisted?.title).toBe('New Name');
  });

  it('should save layers to a file', async () => {
    const file = await files3dStore.create('Layered Scene');
    const now = new Date();
    const newLayers = [
      {
        id: 'layer-1',
        name: 'Ground',
        visible: true,
        text: 'ground plane',
        entities: [],
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'layer-2',
        name: 'Objects',
        visible: true,
        text: 'scene objects',
        entities: [],
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await files3dStore.updateLayers(file.id, newLayers);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.layers).toHaveLength(2);
    expect(found?.layers[0].name).toBe('Ground');
    expect(found?.layers[1].name).toBe('Objects');

    // Verify persistence
    const persisted = await db.files3d.get(file.id);
    expect(persisted?.layers).toHaveLength(2);
  });

  it('should load files on init', async () => {
    const now = new Date();
    await db.files3d.add({
      id: 'preexisting',
      title: 'Pre-existing Scene',
      createdAt: now,
      updatedAt: now,
      layers: [],
      theme: 'dark',
    });

    await files3dStore.init();
    const state = get(files3dStore);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].id).toBe('preexisting');
    expect(state.files[0].title).toBe('Pre-existing Scene');
  });

  it('should set active file', async () => {
    const file1 = await files3dStore.create('Scene 1');
    const file2 = await files3dStore.create('Scene 2');

    // file2 should be active after creation
    let state = get(files3dStore);
    expect(state.activeFileId).toBe(file2.id);

    // Switch to file1
    files3dStore.setActive(file1.id);
    state = get(files3dStore);
    expect(state.activeFileId).toBe(file1.id);
  });

  it('should update camera state', async () => {
    const file = await files3dStore.create('Camera Test');
    const camera = {
      mode: 'orbit' as const,
      position: [5, 10, 15] as [number, number, number],
      target: 'some-entity-id',
    };

    await files3dStore.updateCamera(file.id, camera);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.camera).toEqual(camera);

    // Verify persistence
    const persisted = await db.files3d.get(file.id);
    expect(persisted?.camera).toEqual(camera);
  });
});
