// src/lib/3d/pipeline-bridge.ts
import type { VisualizationSchema } from '$lib/types';
import type { Layer3d } from './entity-spec';
import type { RenderOptions } from './observation-modes/types';

export interface Extractor {
	extract(
		text: string,
		schema: VisualizationSchema | null,
	): Promise<VisualizationSchema>;
}

export interface ModeProvider {
	getMode(
		id: string,
	):
		| {
				id: string;
				name: string;
				description: string;
				render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
			}
		| undefined;
}

export interface PipelineBridge {
	process(
		text: string,
		modeId: string,
		options: RenderOptions,
	): Promise<Layer3d[]>;
}

export function createPipelineBridge(
	extractor: Extractor,
	modeProvider: ModeProvider,
): PipelineBridge {
	return {
		async process(text, modeId, options) {
			const mode = modeProvider.getMode(modeId);
			if (!mode) {
				throw new Error(`Unknown observation mode: ${modeId}`);
			}

			const schema = await extractor.extract(text, null);
			return mode.render(schema, options);
		},
	};
}
