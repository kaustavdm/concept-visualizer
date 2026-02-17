import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { filesStore } from './files';
import { db } from '$lib/db';

describe('filesStore', () => {
  beforeEach(async () => {
    await db.files.clear();
    await filesStore.init();
  });

  it('should create a new file and set it as active', async () => {
    const file = await filesStore.create('Test Concept');
    expect(file.title).toBe('Test Concept');
    expect(file.text).toBe('');
    expect(file.visualization).toBeNull();

    const state = get(filesStore);
    expect(state.activeFileId).toBe(file.id);
    expect(state.files).toHaveLength(1);
  });

  it('should delete a file', async () => {
    const file = await filesStore.create('To Delete');
    await filesStore.remove(file.id);

    const state = get(filesStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();
  });

  it('should update file text', async () => {
    const file = await filesStore.create('Editable');
    await filesStore.updateText(file.id, 'Hello world');

    const updated = await db.files.get(file.id);
    expect(updated?.text).toBe('Hello world');
  });

  it('should rename a file', async () => {
    const file = await filesStore.create('Old Name');
    await filesStore.rename(file.id, 'New Name');

    const state = get(filesStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.title).toBe('New Name');
  });

  it('should load files on init', async () => {
    await db.files.add({
      id: 'preexisting',
      title: 'Pre-existing',
      createdAt: new Date(),
      updatedAt: new Date(),
      text: 'hello',
      visualization: null,
      settings: { autoSend: false }
    });

    await filesStore.init();
    const state = get(filesStore);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].id).toBe('preexisting');
  });
});
