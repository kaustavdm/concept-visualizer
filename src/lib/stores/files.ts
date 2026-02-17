import { writable, get } from 'svelte/store';
import { v4 as uuid } from 'uuid';
import { db } from '$lib/db';
import type { ConceptFile, VisualizationSchema } from '$lib/types';

interface FilesState {
  files: ConceptFile[];
  activeFileId: string | null;
}

function createFilesStore() {
  const { subscribe, set, update } = writable<FilesState>({
    files: [],
    activeFileId: null
  });

  async function init() {
    const files = await db.files.orderBy('updatedAt').reverse().toArray();
    const state = get({ subscribe });
    set({
      files,
      activeFileId: state.activeFileId ?? files[0]?.id ?? null
    });
  }

  async function create(title: string): Promise<ConceptFile> {
    const now = new Date();
    const file: ConceptFile = {
      id: uuid(),
      title,
      createdAt: now,
      updatedAt: now,
      text: '',
      visualization: null,
      settings: { autoSend: false }
    };
    await db.files.add(file);
    update(s => ({
      files: [file, ...s.files],
      activeFileId: file.id
    }));
    return file;
  }

  async function remove(id: string) {
    await db.files.delete(id);
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
    await db.files.update(id, { title, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, title, updatedAt: now } : f)
    }));
  }

  async function updateText(id: string, text: string) {
    const now = new Date();
    await db.files.update(id, { text, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, text, updatedAt: now } : f)
    }));
  }

  async function updateVisualization(id: string, visualization: VisualizationSchema) {
    const now = new Date();
    await db.files.update(id, { visualization, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, visualization, updatedAt: now } : f)
    }));
  }

  async function updateSettings(id: string, settings: Partial<ConceptFile['settings']>) {
    const now = new Date();
    await db.files.where('id').equals(id).modify((file: ConceptFile) => {
      Object.assign(file.settings, settings);
      file.updatedAt = now;
    });
    update(s => ({
      ...s,
      files: s.files.map(f =>
        f.id === id ? { ...f, settings: { ...f.settings, ...settings }, updatedAt: now } : f
      )
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
    updateText,
    updateVisualization,
    updateSettings,
    setActive
  };
}

export const filesStore = createFilesStore();
