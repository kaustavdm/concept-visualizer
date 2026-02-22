import { writable, get } from 'svelte/store';
import { v4 as uuid } from 'uuid';
import { db } from '$lib/db';
import type { Scene3d, Layer3d, ChatMessage } from '$lib/3d/entity-spec';

interface Files3dState {
  files: Scene3d[];
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

  async function create(title: string): Promise<Scene3d> {
    const now = new Date().toISOString();
    const defaultLayer: Layer3d = {
      id: uuid(),
      name: 'Layer 1',
      visible: true,
      text: '',
      entities: [],
      position: 'n',
      source: { type: 'manual' },
      createdAt: now,
      updatedAt: now,
    };
    const scene: Scene3d = {
      id: uuid(),
      title,
      createdAt: now,
      updatedAt: now,
      layers: [defaultLayer],
      version: 1,
      messages: [],
    };
    await db.files3d.add(scene);
    update(s => ({
      files: [scene, ...s.files],
      activeFileId: scene.id
    }));
    return scene;
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
    const now = new Date().toISOString();
    await db.files3d.update(id, { title, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, title, updatedAt: now } : f)
    }));
  }

  async function updateLayers(id: string, layers: Layer3d[]) {
    const now = new Date().toISOString();
    await db.files3d.update(id, { layers, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, layers, updatedAt: now } : f)
    }));
  }

  async function addMessage(id: string, message: ChatMessage) {
    const now = new Date().toISOString();
    const state = get({ subscribe });
    const file = state.files.find(f => f.id === id);
    if (!file) return;
    const messages = [...(file.messages ?? []), message];
    await db.files3d.update(id, { messages, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, messages, updatedAt: now } : f)
    }));
  }

  async function updateEnvironment(id: string, environment: Scene3d['environment']) {
    const now = new Date().toISOString();
    await db.files3d.update(id, { environment, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, environment, updatedAt: now } : f)
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
    addMessage,
    updateEnvironment,
    setActive
  };
}

export const files3dStore = createFiles3dStore();
