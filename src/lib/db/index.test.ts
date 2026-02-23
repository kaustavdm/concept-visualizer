import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

describe('ConceptDB', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it('should store and retrieve app settings', async () => {
    await db.settings.put({
      id: 'app-settings',
      llmEndpoint: 'http://localhost:11434/v1',
      llmModel: 'llama3.2',
      theme: 'light',
      controlPlacement: 'hud',
      tier2Enabled: true,
      tier3Enabled: true,
      llmEnrichmentLevel: 'minimal',
      defaultObservationMode: 'graph',
      onboardingCompleted: false,
    });

    const settings = await db.settings.get('app-settings');
    expect(settings?.llmEndpoint).toBe('http://localhost:11434/v1');
  });

  it('should have files3d table available (v4 migration)', async () => {
    // Verify the DB instance exposes the files3d table after v4 schema
    expect(db.files3d).toBeDefined();
    await db.files3d.clear();
    const count = await db.files3d.count();
    expect(count).toBe(0);
  });
});
