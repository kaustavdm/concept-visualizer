import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

describe('ConceptDB', () => {
  beforeEach(async () => {
    await db.files.clear();
    await db.settings.clear();
  });

  it('should create a concept file', async () => {
    const id = await db.files.add({
      id: 'test-1',
      title: 'Test Concept',
      createdAt: new Date(),
      updatedAt: new Date(),
      text: '',
      visualization: null,
      settings: { autoSend: false }
    });
    expect(id).toBe('test-1');

    const file = await db.files.get('test-1');
    expect(file?.title).toBe('Test Concept');
  });

  it('should store and retrieve app settings', async () => {
    await db.settings.put({
      id: 'app-settings',
      llmEndpoint: 'http://localhost:11434/v1',
      llmModel: 'llama3.2',
      theme: 'light',
      controlPlacement: 'hud',
      extractionEngine: 'llm',
      pipelineMode: 'auto',
      llmRefinement: false
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

  it('should list files sorted by updatedAt', async () => {
    const now = new Date();
    await db.files.bulkAdd([
      {
        id: 'old',
        title: 'Old',
        createdAt: new Date(now.getTime() - 2000),
        updatedAt: new Date(now.getTime() - 2000),
        text: '',
        visualization: null,
        settings: { autoSend: false }
      },
      {
        id: 'new',
        title: 'New',
        createdAt: now,
        updatedAt: now,
        text: '',
        visualization: null,
        settings: { autoSend: false }
      }
    ]);

    const files = await db.files.orderBy('updatedAt').reverse().toArray();
    expect(files[0].id).toBe('new');
    expect(files[1].id).toBe('old');
  });
});
