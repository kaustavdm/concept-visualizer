// src/lib/3d/pipeline-bridge.ts
import type { VisualizationSchema } from '$lib/types';
import type { Layer3d } from './entity-spec';
import type { RenderOptions } from './observation-modes/types';
import type { TieredRunner } from '$lib/pipeline/runner';
import type { PipelineStage } from '$lib/pipeline/types';

/** @deprecated Kept for backward compatibility. Use TieredRunner instead. */
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

export interface TieredBridgeResult {
	tier: number;
	layers: Layer3d[];
	schema: VisualizationSchema;
}

export interface PipelineBridge {
	process(
		text: string,
		modeId: string,
		options: RenderOptions,
		onStage?: (stage: PipelineStage) => void,
	): AsyncGenerator<TieredBridgeResult>;
	abort(): void;
}

export function createPipelineBridge(
	runner: TieredRunner,
	modeProvider: ModeProvider,
): PipelineBridge {
	return {
		async *process(text, modeId, options, onStage) {
			const mode = modeProvider.getMode(modeId);
			if (!mode) {
				throw new Error(`Unknown observation mode: ${modeId}`);
			}

			for await (const result of runner.run(text, onStage)) {
				const layers = mode.render(result.schema, options);
				yield { tier: result.tier, layers, schema: result.schema };
			}
		},

		abort() {
			runner.abort();
		},
	};
}
