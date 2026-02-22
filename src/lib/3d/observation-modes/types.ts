// src/lib/3d/observation-modes/types.ts
import type { VisualizationSchema } from '$lib/types';
import type { Layer3d } from '../entity-spec';
import type { PrefabDefinition } from '../prefabs';

export interface RenderOptions {
	theme: 'light' | 'dark';
	existingLayers?: Layer3d[];
	messageId?: string;
}

export interface ObservationMode {
	id: string;
	name: string;
	description: string;
	prefabs?: PrefabDefinition[];
	render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
	systemPromptOverride?: string;
}
