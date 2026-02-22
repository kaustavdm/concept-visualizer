import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { files3dStore } from './files3d';
import { db } from '$lib/db';
import type { Layer3d, ChatMessage } from '$lib/3d/entity-spec';

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

  it('should create a new Scene3d with default layer', async () => {
    const scene = await files3dStore.create('Test 3D Scene');
    expect(scene.title).toBe('Test 3D Scene');
    expect(scene.version).toBe(1);
    expect(scene.messages).toEqual([]);
    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0].name).toBe('Layer 1');
    expect(scene.layers[0].visible).toBe(true);
    expect(scene.layers[0].text).toBe('');
    expect(scene.layers[0].entities).toEqual([]);
    expect(scene.layers[0].position).toBe('n');
    expect(scene.layers[0].source).toEqual({ type: 'manual' });
    expect(typeof scene.createdAt).toBe('string');
    expect(typeof scene.layers[0].createdAt).toBe('string');

    const state = get(files3dStore);
    expect(state.activeFileId).toBe(scene.id);
    expect(state.files).toHaveLength(1);

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted?.title).toBe('Test 3D Scene');
    expect(persisted?.layers).toHaveLength(1);
    expect(persisted?.version).toBe(1);
  });

  it('should delete a file', async () => {
    const scene = await files3dStore.create('To Delete');
    await files3dStore.remove(scene.id);

    const state = get(files3dStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted).toBeUndefined();
  });

  it('should rename a file', async () => {
    const scene = await files3dStore.create('Old Name');
    await files3dStore.rename(scene.id, 'New Name');

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === scene.id);
    expect(found?.title).toBe('New Name');

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted?.title).toBe('New Name');
  });

  it('should save layers to a file', async () => {
    const scene = await files3dStore.create('Layered Scene');
    const now = new Date().toISOString();
    const newLayers: Layer3d[] = [
      {
        id: 'layer-1',
        name: 'Ground',
        visible: true,
        text: 'ground plane',
        entities: [],
        position: 'a',
        source: { type: 'manual' },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'layer-2',
        name: 'Objects',
        visible: true,
        text: 'scene objects',
        entities: [],
        position: 'b',
        source: { type: 'manual' },
        createdAt: now,
        updatedAt: now,
      },
    ];

    await files3dStore.updateLayers(scene.id, newLayers);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === scene.id);
    expect(found?.layers).toHaveLength(2);
    expect(found?.layers[0].name).toBe('Ground');
    expect(found?.layers[1].name).toBe('Objects');

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted?.layers).toHaveLength(2);
  });

  it('should load files on init', async () => {
    const now = new Date().toISOString();
    await db.files3d.add({
      id: 'preexisting',
      title: 'Pre-existing Scene',
      createdAt: now,
      updatedAt: now,
      layers: [],
      version: 1,
    });

    await files3dStore.init();
    const state = get(files3dStore);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].id).toBe('preexisting');
    expect(state.files[0].title).toBe('Pre-existing Scene');
  });

  it('should set active file', async () => {
    const scene1 = await files3dStore.create('Scene 1');
    const scene2 = await files3dStore.create('Scene 2');

    // scene2 should be active after creation
    let state = get(files3dStore);
    expect(state.activeFileId).toBe(scene2.id);

    // Switch to scene1
    files3dStore.setActive(scene1.id);
    state = get(files3dStore);
    expect(state.activeFileId).toBe(scene1.id);
  });

  it('should add a chat message', async () => {
    const scene = await files3dStore.create('Chat Test');
    const message: ChatMessage = {
      id: 'msg-1',
      text: 'Create a red sphere',
      timestamp: new Date().toISOString(),
      layerIds: ['layer-1'],
    };

    await files3dStore.addMessage(scene.id, message);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === scene.id);
    expect(found?.messages).toHaveLength(1);
    expect(found?.messages?.[0].id).toBe('msg-1');
    expect(found?.messages?.[0].text).toBe('Create a red sphere');
    expect(found?.messages?.[0].layerIds).toEqual(['layer-1']);

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted?.messages).toHaveLength(1);
    expect(persisted?.messages?.[0].id).toBe('msg-1');
  });

  it('should append multiple messages', async () => {
    const scene = await files3dStore.create('Multi-message');
    const msg1: ChatMessage = {
      id: 'msg-1',
      text: 'First message',
      timestamp: new Date().toISOString(),
      layerIds: [],
    };
    const msg2: ChatMessage = {
      id: 'msg-2',
      text: 'Second message',
      timestamp: new Date().toISOString(),
      layerIds: ['layer-x'],
    };

    await files3dStore.addMessage(scene.id, msg1);
    await files3dStore.addMessage(scene.id, msg2);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === scene.id);
    expect(found?.messages).toHaveLength(2);
    expect(found?.messages?.[0].id).toBe('msg-1');
    expect(found?.messages?.[1].id).toBe('msg-2');
  });

  it('should not add message to non-existent scene', async () => {
    const message: ChatMessage = {
      id: 'msg-orphan',
      text: 'Orphan',
      timestamp: new Date().toISOString(),
      layerIds: [],
    };

    await files3dStore.addMessage('non-existent-id', message);

    const state = get(files3dStore);
    expect(state.files).toHaveLength(0);
  });

  it('should update environment', async () => {
    const scene = await files3dStore.create('Environment Test');
    const environment = {
      ambientColor: [0.1, 0.1, 0.15] as [number, number, number],
      clearColor: [0.01, 0.02, 0.06] as [number, number, number],
      fog: {
        type: 'linear' as const,
        color: [0.5, 0.5, 0.6] as [number, number, number],
        density: 0.01,
      },
    };

    await files3dStore.updateEnvironment(scene.id, environment);

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === scene.id);
    expect(found?.environment).toEqual(environment);

    // Verify persistence
    const persisted = await db.files3d.get(scene.id);
    expect(persisted?.environment).toEqual(environment);
  });
});
