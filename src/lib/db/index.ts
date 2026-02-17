import Dexie, { type EntityTable } from 'dexie';
import type { ConceptFile, AppSettings } from '$lib/types';

class ConceptDB extends Dexie {
  files!: EntityTable<ConceptFile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('ConceptVisualizerDB');
    this.version(1).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
    // Version 2: AppSettings gains extractionEngine + controlPlacement
    // No index changes needed; Dexie stores schemaless objects
    this.version(2).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
  }
}

export const db = new ConceptDB();
