import { writable } from 'svelte/store';
import { db } from '$lib/db';
import { DEFAULT_SETTINGS, type AppSettings } from '$lib/types';

function createSettingsStore() {
  const { subscribe, set } = writable<AppSettings>(DEFAULT_SETTINGS);

  async function init() {
    const stored = await db.settings.get('app-settings');
    if (stored) {
      set(stored);
    } else {
      await db.settings.put(DEFAULT_SETTINGS);
    }
  }

  async function save(changes: Partial<Omit<AppSettings, 'id'>>) {
    const updated = { ...DEFAULT_SETTINGS, ...changes, id: 'app-settings' } as AppSettings;
    await db.settings.put(updated);
    set(updated);
  }

  return { subscribe, init, update: save };
}

export const settingsStore = createSettingsStore();
