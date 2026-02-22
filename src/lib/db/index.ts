import Dexie, { type EntityTable } from 'dexie';
import type { ConceptFile, AppSettings } from '$lib/types';
import type { File3d } from '$lib/3d/types';

class ConceptDB extends Dexie {
  files!: EntityTable<ConceptFile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  files3d!: EntityTable<File3d, 'id'>;

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
    // Version 3: Add files3d table for 3D scene persistence
    this.version(3).stores({
      files: 'id, title, updatedAt',
      settings: 'id',
      files3d: 'id, title, updatedAt'
    });
  }
}

export const db = new ConceptDB();
