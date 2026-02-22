import { writable, get } from 'svelte/store';
import { v4 as uuid } from 'uuid';
import { db } from '$lib/db';
import type { File3d, Layer3d } from '$lib/3d/types';

interface Files3dState {
  files: File3d[];
  activeFileId: string | null;
}

function createFiles3dStore() {
  const { subscribe, set, update } = writable<Files3dState>({
    files: [],
    activeFileId: null
  });

  async function init() {
    const files = await db.files3d.orderBy('updatedAt').reverse().toArray();
    const state = get({ subscribe });
    set({
      files,
      activeFileId: state.activeFileId ?? files[0]?.id ?? null
    });
  }

  async function create(title: string): Promise<File3d> {
    const now = new Date();
    const defaultLayer: Layer3d = {
      id: uuid(),
      name: 'Layer 1',
      visible: true,
      text: '',
      entities: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const file: File3d = {
      id: uuid(),
      title,
      createdAt: now,
      updatedAt: now,
      layers: [defaultLayer],
      theme: 'light',
    };
    await db.files3d.add(file);
    update(s => ({
      files: [file, ...s.files],
      activeFileId: file.id
    }));
    return file;
  }

  async function remove(id: string) {
    await db.files3d.delete(id);
    update(s => {
      const files = s.files.filter(f => f.id !== id);
      return {
        files,
        activeFileId: s.activeFileId === id ? (files[0]?.id ?? null) : s.activeFileId
      };
    });
  }

  async function rename(id: string, title: string) {
    const now = new Date();
    await db.files3d.update(id, { title, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, title, updatedAt: now } : f)
    }));
  }

  async function updateLayers(id: string, layers: Layer3d[]) {
    const now = new Date();
    await db.files3d.update(id, { layers, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, layers, updatedAt: now } : f)
    }));
  }

  async function updateCamera(id: string, camera: File3d['camera']) {
    const now = new Date();
    await db.files3d.update(id, { camera, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, camera, updatedAt: now } : f)
    }));
  }

  function setActive(id: string) {
    update(s => ({ ...s, activeFileId: id }));
  }

  return {
    subscribe,
    init,
    create,
    remove,
    rename,
    updateLayers,
    updateCamera,
    setActive
  };
}

export const files3dStore = createFiles3dStore();
