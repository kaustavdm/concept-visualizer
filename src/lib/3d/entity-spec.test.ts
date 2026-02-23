import { describe, it, expect } from 'vitest';
import type {
	EntitySpec,
	Layer3d,
	Scene3d,
	RenderComponentSpec,
	LightComponentSpec,
	MaterialSpec,
	ChatMessage,
	VersionSnapshot,
} from './entity-spec';
import type { VisualizationSchema } from '$lib/types';

describe('EntitySpec types', () => {
	it('creates a minimal entity with render component', () => {
		const entity: EntitySpec = {
			id: 'sphere-1',
			position: [0, 1, 0],
			components: {
				render: { type: 'sphere' },
			},
			material: {
				diffuse: [255, 0, 0],
			},
		};

		expect(entity.id).toBe('sphere-1');
		expect(entity.position).toEqual([0, 1, 0]);
		expect(entity.components.render?.type).toBe('sphere');
		expect(entity.material?.diffuse).toEqual([255, 0, 0]);
		expect(entity.children).toBeUndefined();
		expect(entity.prefab).toBeUndefined();
		expect(entity.animate).toBeUndefined();
	});

	it('creates an entity with children', () => {
		const parent: EntitySpec = {
			id: 'solar-system',
			components: {},
			children: [
				{
					id: 'sun',
					components: {
						render: { type: 'sphere' },
					},
					material: { diffuse: [255, 200, 50], emissive: [255, 200, 50] },
				},
				{
					id: 'earth',
					position: [5, 0, 0],
					components: {
						render: { type: 'sphere' },
					},
					material: { diffuse: [50, 100, 255] },
					animate: { type: 'orbit', radius: 5, speed: 1 },
					children: [
						{
							id: 'moon',
							position: [1, 0, 0],
							components: {
								render: { type: 'sphere' },
							},
							scale: [0.3, 0.3, 0.3],
							material: { diffuse: [200, 200, 200] },
							animate: { type: 'orbit', center: 'earth', radius: 1, speed: 3 },
						},
					],
				},
			],
		};

		expect(parent.id).toBe('solar-system');
		expect(parent.children).toHaveLength(2);
		expect(parent.children![1].children).toHaveLength(1);
		expect(parent.children![1].children![0].id).toBe('moon');
		expect(parent.children![1].animate).toEqual({ type: 'orbit', radius: 5, speed: 1 });
	});

	it('creates an entity with light component and no render', () => {
		const light: EntitySpec = {
			id: 'sun-light',
			position: [10, 20, 10],
			rotation: [45, -30, 0],
			components: {
				light: {
					type: 'directional',
					color: [255, 250, 240],
					intensity: 1.5,
					castShadows: true,
					shadowResolution: 2048,
				},
			},
		};

		expect(light.id).toBe('sun-light');
		expect(light.components.render).toBeUndefined();
		expect(light.components.light?.type).toBe('directional');
		expect(light.components.light?.intensity).toBe(1.5);
		expect(light.components.light?.castShadows).toBe(true);
		expect(light.components.light?.shadowResolution).toBe(2048);
	});

	it('creates an entity with spot light', () => {
		const spot: EntitySpec = {
			id: 'spotlight-1',
			position: [0, 5, 0],
			rotation: [90, 0, 0],
			components: {
				light: {
					type: 'spot',
					color: [255, 255, 200],
					intensity: 2,
					range: 15,
					innerConeAngle: 20,
					outerConeAngle: 40,
				},
			},
		};

		expect(spot.components.light?.type).toBe('spot');
		expect(spot.components.light?.innerConeAngle).toBe(20);
		expect(spot.components.light?.outerConeAngle).toBe(40);
		expect(spot.components.light?.range).toBe(15);
	});

	it('creates an entity with prefab and overrides', () => {
		const entity: EntitySpec = {
			id: 'custom-tree-1',
			position: [3, 0, -2],
			scale: [1.5, 1.5, 1.5],
			prefab: 'tree',
			components: {
				render: { type: 'cone' },
			},
			material: {
				diffuse: [30, 120, 30],
				metalness: 0,
				gloss: 0.3,
			},
			tags: ['vegetation', 'decoration'],
			followable: false,
			themeResponse: {
				light: { diffuse: [30, 140, 30] },
				dark: { diffuse: [20, 80, 20], emissive: [5, 15, 5] },
			},
		};

		expect(entity.prefab).toBe('tree');
		expect(entity.tags).toEqual(['vegetation', 'decoration']);
		expect(entity.followable).toBe(false);
		expect(entity.themeResponse?.light?.diffuse).toEqual([30, 140, 30]);
		expect(entity.themeResponse?.dark?.emissive).toEqual([5, 15, 5]);
		expect(entity.components.render?.type).toBe('cone');
	});

	it('creates an entity with material opacity and blend type', () => {
		const entity: EntitySpec = {
			id: 'glass-panel',
			components: {
				render: { type: 'plane' },
			},
			material: {
				diffuse: [200, 220, 255],
				opacity: 0.3,
				blendType: 'normal',
				specular: [255, 255, 255],
				gloss: 0.9,
			},
		};

		expect(entity.material?.opacity).toBe(0.3);
		expect(entity.material?.blendType).toBe('normal');
	});

	it('creates an entity with render geometry override', () => {
		const entity: EntitySpec = {
			id: 'custom-cone',
			components: {
				render: {
					type: 'cone',
					castShadows: true,
					receiveShadows: true,
					geometry: {
						type: 'cone',
						capSegments: 32,
						baseRadius: 0.5,
						peakRadius: 0,
						height: 2,
						heightSegments: 5,
					},
				},
			},
			material: { diffuse: [180, 120, 60] },
		};

		expect(entity.components.render?.geometry?.capSegments).toBe(32);
		expect(entity.components.render?.castShadows).toBe(true);
	});

	it('creates an entity with label, weight, and details', () => {
		const entity: EntitySpec = {
			id: 'concept-node',
			components: {
				render: { type: 'sphere' },
			},
			material: { diffuse: [100, 150, 255] },
			label: 'Machine Learning',
			weight: 0.85,
			details: 'A branch of AI focused on learning from data.',
		};

		expect(entity.label).toBe('Machine Learning');
		expect(entity.weight).toBe(0.85);
		expect(entity.details).toBe('A branch of AI focused on learning from data.');
	});

	it('accepts text component on EntitySpec', () => {
		const entity: EntitySpec = {
			id: 'label-1',
			components: {
				text: {
					text: 'Hello World',
					fontSize: 36,
					color: [1, 1, 1],
					billboard: true,
				},
			},
		};
		expect(entity.components.text?.text).toBe('Hello World');
	});
});

describe('Layer3d type', () => {
	it('creates a layer with fractional position and ISO dates', () => {
		const layer: Layer3d = {
			id: 'layer-abc',
			name: 'Concept Cluster A',
			visible: true,
			entities: [
				{
					id: 'node-1',
					components: { render: { type: 'sphere' } },
					material: { diffuse: [100, 200, 100] },
					label: 'Node 1',
					weight: 0.7,
				},
			],
			text: 'A cluster of related concepts',
			position: '0.5',
			source: { type: 'chat', messageId: 'msg-001' },
			createdAt: '2026-02-22T10:00:00.000Z',
			updatedAt: '2026-02-22T10:05:00.000Z',
		};

		expect(layer.id).toBe('layer-abc');
		expect(layer.position).toBe('0.5');
		expect(layer.entities).toHaveLength(1);
		expect(layer.source).toEqual({ type: 'chat', messageId: 'msg-001' });
		expect(layer.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(layer.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(layer.observationMode).toBeUndefined();
	});

	it('creates a layer with manual source', () => {
		const layer: Layer3d = {
			id: 'layer-manual',
			name: 'Manual Layer',
			visible: false,
			entities: [],
			text: '',
			position: '1',
			source: { type: 'manual' },
			createdAt: '2026-02-22T12:00:00.000Z',
			updatedAt: '2026-02-22T12:00:00.000Z',
			observationMode: 'focused',
		};

		expect(layer.source).toEqual({ type: 'manual' });
		expect(layer.visible).toBe(false);
		expect(layer.observationMode).toBe('focused');
	});

	it('creates a layer with clone source', () => {
		const layer: Layer3d = {
			id: 'layer-clone',
			name: 'Cloned Layer',
			visible: true,
			entities: [],
			text: 'Cloned from another layer',
			position: '2',
			source: { type: 'clone', sourceLayerId: 'layer-abc' },
			createdAt: '2026-02-22T14:00:00.000Z',
			updatedAt: '2026-02-22T14:00:00.000Z',
		};

		expect(layer.source).toEqual({ type: 'clone', sourceLayerId: 'layer-abc' });
	});
});

describe('Scene3d type', () => {
	it('creates a scene with version and optional messages', () => {
		const scene: Scene3d = {
			id: 'scene-001',
			title: 'Neural Network Concepts',
			createdAt: '2026-02-22T09:00:00.000Z',
			updatedAt: '2026-02-22T11:00:00.000Z',
			layers: [
				{
					id: 'layer-1',
					name: 'Input Layer',
					visible: true,
					entities: [
						{
							id: 'neuron-1',
							components: { render: { type: 'sphere' } },
							material: { diffuse: [80, 120, 255] },
							label: 'Input Neuron',
							weight: 0.9,
						},
					],
					text: 'The input layer of the network',
					position: '0',
					source: { type: 'chat', messageId: 'msg-100' },
					createdAt: '2026-02-22T09:30:00.000Z',
					updatedAt: '2026-02-22T09:30:00.000Z',
				},
			],
			version: 1,
			messages: [
				{
					id: 'msg-100',
					text: 'Show me a neural network',
					timestamp: '2026-02-22T09:30:00.000Z',
					layerIds: ['layer-1'],
				},
			],
		};

		expect(scene.id).toBe('scene-001');
		expect(scene.version).toBe(1);
		expect(scene.layers).toHaveLength(1);
		expect(scene.messages).toHaveLength(1);
		expect(scene.messages![0].layerIds).toContain('layer-1');
		expect(scene.environment).toBeUndefined();
		expect(scene.camera).toBeUndefined();
		expect(scene.metadata).toBeUndefined();
	});

	it('creates a scene with environment and camera settings', () => {
		const scene: Scene3d = {
			id: 'scene-002',
			title: 'Space Scene',
			createdAt: '2026-02-22T08:00:00.000Z',
			updatedAt: '2026-02-22T08:00:00.000Z',
			layers: [],
			environment: {
				ambientColor: [20, 20, 40],
				clearColor: [5, 5, 15],
				fog: {
					type: 'exp2',
					color: [10, 10, 30],
					density: 0.02,
				},
			},
			camera: {
				mode: 'fly',
				position: [0, 5, 20],
				target: 'planet-1',
			},
			version: 1,
			metadata: { genre: 'sci-fi', complexity: 'high' },
		};

		expect(scene.environment?.ambientColor).toEqual([20, 20, 40]);
		expect(scene.environment?.fog?.type).toBe('exp2');
		expect(scene.environment?.fog?.density).toBe(0.02);
		expect(scene.camera?.mode).toBe('fly');
		expect(scene.camera?.target).toBe('planet-1');
		expect(scene.metadata?.genre).toBe('sci-fi');
	});

	it('creates a scene with no fog', () => {
		const scene: Scene3d = {
			id: 'scene-003',
			title: 'Clear Day',
			createdAt: '2026-02-22T06:00:00.000Z',
			updatedAt: '2026-02-22T06:00:00.000Z',
			layers: [],
			environment: {
				clearColor: [135, 206, 235],
				fog: { type: 'none' },
			},
			version: 2,
		};

		expect(scene.environment?.fog?.type).toBe('none');
		expect(scene.version).toBe(2);
	});

	it('accepts tier and messageId on VersionSnapshot', () => {
		const snap: VersionSnapshot = {
			version: 1,
			timestamp: new Date().toISOString(),
			layers: [],
			description: 'Tier 1',
			tier: 1,
			messageId: 'msg-1',
		};
		expect(snap.tier).toBe(1);
		expect(snap.messageId).toBe('msg-1');

		const minimal: VersionSnapshot = {
			version: 2,
			timestamp: new Date().toISOString(),
			layers: [],
			description: 'No tier',
		};
		expect(minimal.tier).toBeUndefined();
		expect(minimal.messageId).toBeUndefined();
	});

	it('accepts snapshots on Scene3d', () => {
		const scene: Scene3d = {
			id: 'scene-snap',
			title: 'Snapshot Scene',
			createdAt: '2026-02-23T00:00:00.000Z',
			updatedAt: '2026-02-23T00:00:00.000Z',
			layers: [],
			version: 3,
			snapshots: [
				{
					version: 1,
					timestamp: '2026-02-23T00:00:00.000Z',
					layers: [],
					description: 'Initial',
				},
				{
					version: 2,
					timestamp: '2026-02-23T01:00:00.000Z',
					layers: [],
					description: 'Tier 2 refinement',
					tier: 2,
					messageId: 'msg-5',
				},
			],
		};
		expect(scene.snapshots).toHaveLength(2);
		expect(scene.snapshots![1].tier).toBe(2);
		expect(scene.snapshots![1].messageId).toBe('msg-5');
	});
});

describe('ChatMessage type', () => {
	it('creates a chat message with observation mode', () => {
		const msg: ChatMessage = {
			id: 'msg-200',
			text: 'Explain quantum computing',
			timestamp: '2026-02-22T15:00:00.000Z',
			layerIds: ['layer-q1', 'layer-q2'],
			observationMode: 'detailed',
		};

		expect(msg.id).toBe('msg-200');
		expect(msg.layerIds).toHaveLength(2);
		expect(msg.observationMode).toBe('detailed');
	});

	it('accepts schema on ChatMessage', () => {
		const msg: ChatMessage = {
			id: 'msg-1',
			text: 'test',
			timestamp: new Date().toISOString(),
			layerIds: [],
			schema: {
				type: 'graph',
				title: 'Test',
				description: 'Test schema',
				nodes: [],
				edges: [],
				metadata: { concepts: [], relationships: [] },
			},
		};
		expect(msg.schema?.type).toBe('graph');

		const noSchema: ChatMessage = {
			id: 'msg-2',
			text: 'no cache',
			timestamp: new Date().toISOString(),
			layerIds: [],
		};
		expect(noSchema.schema).toBeUndefined();
	});
});
