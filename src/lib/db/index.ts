import Dexie, { type EntityTable, type Table } from 'dexie';
import type { AppSettings } from '$lib/types';

class ConceptDB extends Dexie {
  settings!: EntityTable<AppSettings, 'id'>;
  // Use Table<any> to avoid circular KeyPaths inference from recursive
  // EntitySpec.children. The files3d store provides proper Scene3d typing.
  files3d!: Table<any, string>;

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
    // Version 4: Migrate File3d → Scene3d shape
    this.version(4).stores({
      files: 'id, title, updatedAt',
      settings: 'id',
      files3d: 'id, title, updatedAt'
    }).upgrade(tx => {
      return tx.table('files3d').toCollection().modify(file => {
        // Migrate layers
        file.layers = (file.layers || []).map((layer: any, i: number) => ({
          ...layer,
          position: String.fromCharCode('a'.charCodeAt(0) + i),
          source: { type: 'manual' },
          createdAt: layer.createdAt instanceof Date ? layer.createdAt.toISOString() : layer.createdAt,
          updatedAt: layer.updatedAt instanceof Date ? layer.updatedAt.toISOString() : layer.updatedAt,
          entities: (layer.entities || []).map((entity: any) => {
            const { mesh, opacity, ...rest } = entity;
            return {
              ...rest,
              components: {
                render: typeof mesh === 'string'
                  ? { type: mesh }
                  : mesh?.type ? { type: mesh.type, geometry: mesh } : undefined,
              },
            };
          }),
        }));
        // Remove order field
        for (const layer of file.layers) {
          delete (layer as any).order;
          delete (layer as any).audioBlob;
        }
        // Migrate file-level fields
        file.version = 1;
        file.messages = [];
        if (file.theme) {
          file.environment = {
            clearColor: file.theme === 'dark' ? [0.01, 0.02, 0.06] : [0.92, 0.93, 0.95],
            ambientColor: file.theme === 'dark' ? [0.08, 0.08, 0.12] : [0.5, 0.5, 0.55],
          };
          delete (file as any).theme;
        }
        file.createdAt = file.createdAt instanceof Date ? file.createdAt.toISOString() : file.createdAt;
        file.updatedAt = file.updatedAt instanceof Date ? file.updatedAt.toISOString() : file.updatedAt;
      });
    });
  }
}

export const db = new ConceptDB();

/**
 * Delete the entire database. After calling this, the page must be reloaded
 * because Dexie's connection is invalidated.
 */
export async function resetDatabase(): Promise<void> {
  db.close();
  await Dexie.delete('ConceptVisualizerDB');
}
