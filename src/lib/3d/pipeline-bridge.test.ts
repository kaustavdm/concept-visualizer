// src/lib/3d/pipeline-bridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createPipelineBridge } from './pipeline-bridge';
import type { TieredRunner } from '$lib/pipeline/runner';
import type { VisualizationSchema } from '$lib/types';
import type { Layer3d } from './entity-spec';
import type { PipelineStage } from '$lib/pipeline/types';

function mockSchema(title: string): VisualizationSchema {
	return {
		type: 'graph',
		title,
		description: title,
		nodes: [{ id: 'a', label: 'A' }],
		edges: [],
		metadata: { concepts: [], relationships: [] },
	};
}

function mockLayer(id: string): Layer3d {
	return {
		id,
		name: `Layer ${id}`,
		visible: true,
		entities: [],
		text: '',
		position: 'n',
		source: { type: 'manual' as const },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

function createMockRunner(tierResults: { tier: number; schema: VisualizationSchema }[]): TieredRunner {
	const abortFn = vi.fn();
	return {
		async *run(text, onStage) {
			for (const result of tierResults) {
				yield result;
			}
		},
		abort: abortFn,
	};
}

describe('PipelineBridge (tiered)', () => {
	it('yields progressive results through tiers', async () => {
		const schema1 = mockSchema('Tier 1');
		const schema2 = mockSchema('Tier 2');
		const layer1 = mockLayer('l1');
		const layer2 = mockLayer('l2');

		const mockRender = vi.fn()
			.mockReturnValueOnce([layer1])
			.mockReturnValueOnce([layer2]);

		const runner = createMockRunner([
			{ tier: 1, schema: schema1 },
			{ tier: 2, schema: schema2 },
		]);

		const bridge = createPipelineBridge(runner, {
			getMode: () => ({
				id: 'graph',
				name: 'Graph',
				description: '',
				render: mockRender,
			}),
		});

		const results: { tier: number; layers: Layer3d[]; schema: VisualizationSchema }[] = [];
		for await (const result of bridge.process('test text', 'graph', { theme: 'light' })) {
			results.push(result);
		}

		expect(results).toHaveLength(2);
		expect(results[0].tier).toBe(1);
		expect(results[0].layers).toEqual([layer1]);
		expect(results[0].schema).toBe(schema1);
		expect(results[1].tier).toBe(2);
		expect(results[1].layers).toEqual([layer2]);
		expect(results[1].schema).toBe(schema2);
	});

	it('passes options to mode renderer', async () => {
		const schema = mockSchema('Test');
		const mockRender = vi.fn().mockReturnValue([]);
		const runner = createMockRunner([{ tier: 1, schema }]);
		const opts = { theme: 'dark' as const };

		const bridge = createPipelineBridge(runner, {
			getMode: () => ({
				id: 'graph',
				name: 'Graph',
				description: '',
				render: mockRender,
			}),
		});

		for await (const _ of bridge.process('text', 'graph', opts)) {
			// consume
		}

		expect(mockRender).toHaveBeenCalledWith(schema, opts);
	});

	it('throws if mode not found', async () => {
		const runner = createMockRunner([]);
		const bridge = createPipelineBridge(runner, {
			getMode: () => undefined,
		});

		const gen = bridge.process('text', 'unknown', { theme: 'light' });
		await expect(gen.next()).rejects.toThrow('Unknown observation mode: unknown');
	});

	it('abort delegates to runner', () => {
		const runner = createMockRunner([]);
		const bridge = createPipelineBridge(runner, {
			getMode: () => undefined,
		});

		bridge.abort();

		expect(runner.abort).toHaveBeenCalled();
	});

	it('passes onStage to runner', async () => {
		const schema = mockSchema('Test');
		const onStage = vi.fn();
		const runSpy = vi.fn();

		const runner: TieredRunner = {
			async *run(text, onStageCb) {
				runSpy(text, onStageCb);
				yield { tier: 1, schema };
			},
			abort: vi.fn(),
		};

		const bridge = createPipelineBridge(runner, {
			getMode: () => ({
				id: 'graph',
				name: 'Graph',
				description: '',
				render: () => [],
			}),
		});

		for await (const _ of bridge.process('text', 'graph', { theme: 'light' }, onStage)) {
			// consume
		}

		expect(runSpy).toHaveBeenCalledWith('text', onStage);
	});
});
