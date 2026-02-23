import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { settingsStore } from './settings';
import { db } from '$lib/db';
import { DEFAULT_SETTINGS } from '$lib/types';

describe('settingsStore', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it('should initialize with defaults when no settings exist', async () => {
    await settingsStore.init();
    const settings = get(settingsStore);
    expect(settings.llmEndpoint).toBe(DEFAULT_SETTINGS.llmEndpoint);
    expect(settings.llmModel).toBe(DEFAULT_SETTINGS.llmModel);
  });

  it('should persist updated settings', async () => {
    await settingsStore.init();
    await settingsStore.update({ llmEndpoint: 'http://custom:8080/v1' });

    const settings = get(settingsStore);
    expect(settings.llmEndpoint).toBe('http://custom:8080/v1');

    const stored = await db.settings.get('app-settings');
    expect(stored?.llmEndpoint).toBe('http://custom:8080/v1');
  });

  it('should include tiered pipeline defaults', async () => {
    await settingsStore.init();
    const settings = get(settingsStore);
    expect(settings.tier2Enabled).toBe(true);
    expect(settings.tier3Enabled).toBe(true);
    expect(settings.llmEnrichmentLevel).toBe('minimal');
    expect(settings.defaultObservationMode).toBe('graph');
  });
});
