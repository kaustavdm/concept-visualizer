/**
 * Integration test: Full pipeline flow from text → tiered extraction → observation mode → compositor.
 *
 * Uses real Tier 1 (JS extraction) and mock Tier 2/3 to verify the entire
 * data flow without needing TF.js or an LLM endpoint.
 */
import { describe, it, expect } from 'vitest';
import { createTieredRunner } from './runner';
import { createPipelineBridge } from '$lib/3d/pipeline-bridge';
import { createObservationModeRegistry } from '$lib/3d/observation-modes/registry';
import { graphMode } from '$lib/3d/observation-modes/graph';
import { moralityMode } from '$lib/3d/observation-modes/morality';
import { tier1Extract } from './tiers/tier1-extract';
import { composeLayers } from '$lib/3d/compositor';
import type { TierFn } from './tiers/types';
import type { PipelineStage } from './types';

const TEXT = `
Photosynthesis converts sunlight into chemical energy.
Plants use chlorophyll to absorb light, which drives the conversion
of carbon dioxide and water into glucose and oxygen.
The process occurs in chloroplasts within plant cells.
Glucose provides energy for cellular respiration.
`;

// Mock Tier 2: adds themes and refines edge strengths
const mockTier2: TierFn = async (schema) => ({
	...schema,
	nodes: schema.nodes.map((n, i) => ({
		...n,
		theme: i < 3 ? 'light-reactions' : 'products',
	})),
	edges: schema.edges.map((e) => ({
		...e,
		strength: Math.min(1, (e.strength ?? 0.5) + 0.1),
	})),
});

// Mock Tier 3: adds modeRoles and details
const mockTier3: TierFn = async (schema) => ({
	...schema,
	nodes: schema.nodes.map((n, i) => ({
		...n,
		modeRole: i === 0 ? 'core' : i < 3 ? 'supporting' : 'peripheral',
		details: `Description for ${n.label}`,
	})),
});

describe('Pipeline integration', () => {
	it('Tier 1 extracts nodes and edges from text', async () => {
		const runner = createTieredRunner({ tier1: tier1Extract, tier2: null, tier3: null });
		const results = [];
		for await (const r of runner.run(TEXT)) {
			results.push(r);
		}

		expect(results).toHaveLength(1);
		expect(results[0].tier).toBe(1);
		expect(results[0].schema.nodes.length).toBeGreaterThan(0);
		// Should extract keywords like "photosynthesis", "chlorophyll", "glucose"
		const labels = results[0].schema.nodes.map((n) => n.label.toLowerCase());
		expect(labels.some((l) => l.includes('photo') || l.includes('chloro') || l.includes('glucose'))).toBe(true);
	});

	it('full 3-tier pipeline yields progressively', async () => {
		const stages: PipelineStage[] = [];
		const runner = createTieredRunner({
			tier1: tier1Extract,
			tier2: mockTier2,
			tier3: mockTier3,
		});

		const results = [];
		for await (const r of runner.run(TEXT, (s) => stages.push(s))) {
			results.push(r);
		}

		expect(results).toHaveLength(3);
		expect(results.map((r) => r.tier)).toEqual([1, 2, 3]);

		// Tier 2 adds themes
		const t2Themes = results[1].schema.nodes.map((n) => n.theme);
		expect(t2Themes.some((t) => t === 'light-reactions')).toBe(true);

		// Tier 3 adds modeRoles and details
		const t3 = results[2].schema;
		expect(t3.nodes[0].modeRole).toBe('core');
		expect(t3.nodes[0].details).toBeDefined();

		// Stage progression includes all checkpoints
		expect(stages).toContain('tier1-extracting');
		expect(stages).toContain('tier1-complete');
		expect(stages).toContain('tier2-embedding');
		expect(stages).toContain('tier2-complete');
		expect(stages).toContain('tier3-enriching');
		expect(stages).toContain('tier3-complete');
		expect(stages).toContain('complete');
	});

	it('pipeline bridge renders layers through graph mode', async () => {
		const registry = createObservationModeRegistry();
		registry.register(graphMode);

		const runner = createTieredRunner({
			tier1: tier1Extract,
			tier2: mockTier2,
			tier3: null,
		});
		const bridge = createPipelineBridge(runner, registry);

		const results = [];
		for await (const r of bridge.process(TEXT, 'graph', { theme: 'dark' })) {
			results.push(r);
		}

		expect(results.length).toBeGreaterThanOrEqual(1);
		for (const r of results) {
			expect(r.layers.length).toBeGreaterThanOrEqual(3);
			expect(r.schema.nodes.length).toBeGreaterThan(0);
		}

		// Last tier's layers should have concept entities
		const last = results[results.length - 1];
		const conceptsLayer = last.layers.find((l) => l.name === 'Concepts');
		expect(conceptsLayer).toBeDefined();
		expect(conceptsLayer!.entities.length).toBeGreaterThan(0);
	});

	it('pipeline bridge renders layers through morality mode', async () => {
		const registry = createObservationModeRegistry();
		registry.register(moralityMode);

		const runner = createTieredRunner({
			tier1: tier1Extract,
			tier2: mockTier2,
			tier3: mockTier3,
		});
		const bridge = createPipelineBridge(runner, registry);

		const results = [];
		for await (const r of bridge.process(TEXT, 'morality', { theme: 'dark' })) {
			results.push(r);
		}

		expect(results).toHaveLength(3);

		// Final tier should produce morality layers
		const last = results[2];
		expect(last.layers.some((l) => l.observationMode === 'morality')).toBe(true);
		expect(last.layers.some((l) => l.name === 'Environment')).toBe(true);
		expect(last.layers.some((l) => l.name === 'Concepts')).toBe(true);
	});

	it('compositor merges observation mode layers into SceneContent', async () => {
		const registry = createObservationModeRegistry();
		registry.register(graphMode);

		const runner = createTieredRunner({
			tier1: tier1Extract,
			tier2: mockTier2,
			tier3: null,
		});
		const bridge = createPipelineBridge(runner, registry);

		let lastLayers;
		for await (const r of bridge.process(TEXT, 'graph', { theme: 'dark' })) {
			lastLayers = r.layers;
		}

		expect(lastLayers).toBeDefined();
		const scene = composeLayers(lastLayers!, 'integration-test');

		// SceneContent should have namespaced entities
		expect(scene.entities.length).toBeGreaterThan(0);
		// All entity IDs should be namespaced with layer ID
		for (const e of scene.entities) {
			expect(e.id).toContain(':');
		}
	});

	it('abort stops pipeline mid-execution', async () => {
		const runner = createTieredRunner({
			tier1: tier1Extract,
			tier2: async (s) => {
				await new Promise((r) => setTimeout(r, 200));
				return s;
			},
			tier3: null,
		});

		const results = [];
		for await (const r of runner.run(TEXT)) {
			results.push(r);
			if (r.tier === 1) runner.abort();
		}

		// Only tier 1 should yield
		expect(results).toHaveLength(1);
		expect(results[0].tier).toBe(1);
	});
});
