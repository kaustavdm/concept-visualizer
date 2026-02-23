// src/lib/3d/observation-modes/graph.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';
import { computeEdgeRotation } from './edge-utils';

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'graph',
		...partial,
	};
}

export const graphMode: ObservationMode = {
	id: 'graph',
	name: 'Graph',
	description: 'Concept graph with nodes and connections in 3D space',

	roles: [
		{ id: 'core', label: 'Core', description: 'Central concept the text revolves around', prefab: 'graph:core', relevance: 'high' },
		{ id: 'supporting', label: 'Supporting', description: 'Detail or elaboration on a core idea', prefab: 'graph:supporting', relevance: 'high' },
		{ id: 'peripheral', label: 'Peripheral', description: 'Background context or tangential mention', prefab: 'graph:peripheral', relevance: 'medium' },
		{ id: 'emergent', label: 'Emergent', description: 'Result, conclusion, or outcome', prefab: 'graph:emergent', relevance: 'low' },
	],

	prefabs: [
		{
			id: 'graph:core',
			description: 'Large bright sphere for core concepts',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.31, 0.55, 1.0], metalness: 0.3, gloss: 0.6 },
				scale: [1.5, 1.5, 1.5],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'graph:supporting',
			description: 'Medium green sphere for supporting concepts',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.47, 0.78, 0.47], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.0, 1.0],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'graph:peripheral',
			description: 'Small amber sphere for peripheral concepts',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.78, 0.63, 0.31], metalness: 0.3, gloss: 0.6 },
				scale: [0.7, 0.7, 0.7],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'graph:emergent',
			description: 'Torus shape for emergent conclusions',
			template: {
				components: { render: { type: 'torus', castShadows: true } },
				material: { diffuse: [0.78, 0.31, 0.63], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.0, 1.0],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'Classify each concept by structural importance: is it a core idea the text revolves around, a supporting detail, background context, or a result/conclusion?',

	render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[] {
		const nodes = schema.nodes || [];
		const edges = schema.edges || [];

		// Position nodes in a circle on the XZ plane
		const radius = Math.max(3, nodes.length * 1.5);
		const nodePositions = new Map<string, [number, number, number]>();

		nodes.forEach((node, i) => {
			const angle = (2 * Math.PI * i) / nodes.length;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			const y = 1 + (node.weight ?? 0.5) * 2;
			nodePositions.set(node.id, [x, y, z]);
		});

		// Ground layer — a flat plane as the floor
		const groundEntities: EntitySpec[] = [{
			id: 'ground',
			components: { render: { type: 'plane' } },
			position: [0, 0, 0],
			scale: [radius * 3, 1, radius * 3],
			material: {
				diffuse: options?.theme === 'dark' ? [0.12, 0.12, 0.16] : [0.86, 0.88, 0.9],
				opacity: 0.5,
				blendType: 'normal',
			},
		}];

		// Concepts layer — one prefab-backed entity per node with text labels
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1, 0];
			const weight = node.weight ?? 0.5;
			const s = 0.5 + weight * 1.5;

			return {
				id: node.id,
				prefab: `graph:${node.modeRole ?? 'core'}`,
				components: {},
				position: pos,
				scale: [s, s, s] as [number, number, number],
				label: node.label,
				weight: node.weight,
				details: node.details,
				tags: node.theme ? [node.theme] : [],
				followable: true,
				children: [
					{
						id: `${node.id}-label`,
						components: {
							text: {
								text: node.label,
								fontSize: 24,
								color: [1, 1, 1] as [number, number, number],
								billboard: true,
							},
						},
						position: [0, 1.2, 0] as [number, number, number],
						scale: [1.5, 1.5, 1.5] as [number, number, number],
					},
				],
			} satisfies EntitySpec;
		});

		// Connections layer — one elongated box per edge
		const connectionEntities: EntitySpec[] = edges.map(edge => {
			const sourcePos = nodePositions.get(edge.source) ?? [0, 0, 0];
			const targetPos = nodePositions.get(edge.target) ?? [0, 0, 0];

			const midX = (sourcePos[0] + targetPos[0]) / 2;
			const midY = (sourcePos[1] + targetPos[1]) / 2;
			const midZ = (sourcePos[2] + targetPos[2]) / 2;

			const dx = targetPos[0] - sourcePos[0];
			const dy = targetPos[1] - sourcePos[1];
			const dz = targetPos[2] - sourcePos[2];
			const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

			const strength = edge.strength ?? 0.5;
			const thickness = 0.02 + strength * 0.08;

			return {
				id: `edge-${edge.source}-${edge.target}`,
				components: { render: { type: 'box' as const } },
				position: [midX, midY, midZ] as [number, number, number],
				scale: [thickness, length, thickness] as [number, number, number],
				rotation: computeEdgeRotation(dx, dy, dz),
				material: {
					diffuse: [0.39, 0.39, 0.47] as [number, number, number],
					opacity: 0.3 + strength * 0.4,
					blendType: 'normal' as const,
				},
				label: edge.label,
			};
		});

		return [
			makeLayer({ name: 'Environment', entities: groundEntities, position: 'a' }),
			makeLayer({ name: 'Concepts', entities: conceptEntities, position: 'n' }),
			makeLayer({ name: 'Connections', entities: connectionEntities, position: 'z' }),
		];
	},
};
