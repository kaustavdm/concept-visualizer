// src/lib/3d/observation-modes/ontology.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';
import { computeEdgeRotation } from './edge-utils';

/**
 * Ontology observation mode — Natural history museum.
 *
 * Roles: category, instance, property, process
 * Layout: category at Y=0.5 (flat platforms), instance at Y=2 (amber spheres),
 *         property at Y=1.5 (thin capsule pillars), process at Y=3 (spinning tori).
 * Visual: parchment ground, warm white lighting, museum-style classification display.
 */

// Edge color: warm brown
const EDGE_COLOR: [number, number, number] = [0.5, 0.4, 0.3];

// Ground color: parchment
const GROUND_COLOR: [number, number, number] = [0.83, 0.77, 0.63];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'ontology',
		...partial,
	};
}

/**
 * Position a node based on its modeRole.
 * Categories form a grid on the XZ plane; instances, properties, and processes
 * spread in rings at their respective Y levels.
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	switch (role) {
		case 'category': {
			// Grid layout on XZ plane at Y=0.5
			const cols = Math.ceil(Math.sqrt(countInRole));
			const row = Math.floor(indexInRole / cols);
			const col = indexInRole % cols;
			const spacing = 3.5;
			const offsetX = ((cols - 1) * spacing) / 2;
			const offsetZ = ((Math.ceil(countInRole / cols) - 1) * spacing) / 2;
			return [col * spacing - offsetX, 0.5, row * spacing - offsetZ];
		}

		case 'instance': {
			// Elevated ring at Y=2
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 3;
			return [Math.cos(angle) * radius, 2, Math.sin(angle) * radius];
		}

		case 'property': {
			// Mid-height ring at Y=1.5
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2.5;
			return [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius];
		}

		case 'process': {
			// Top ring at Y=3
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2.5;
			return [Math.cos(angle) * radius, 3, Math.sin(angle) * radius];
		}

		default: {
			// No role — ring at Y=1.5
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2;
			return [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius];
		}
	}
}

export const ontologyMode: ObservationMode = {
	id: 'ontology',
	name: 'Ontology',
	description: 'Natural history museum classification — categories, instances, properties, and processes',

	roles: [
		{ id: 'category', label: 'Category', description: 'A general class or type of thing', prefab: 'ontology:category', relevance: 'high' },
		{ id: 'instance', label: 'Instance', description: 'A specific example or member of a category', prefab: 'ontology:instance', relevance: 'high' },
		{ id: 'property', label: 'Property', description: 'An attribute or characteristic of an entity', prefab: 'ontology:property', relevance: 'medium' },
		{ id: 'process', label: 'Process', description: 'An event, action, or transformation', prefab: 'ontology:process', relevance: 'medium' },
	],

	prefabs: [
		{
			id: 'ontology:category',
			description: 'Flat box platform for categories — parchment tan',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.7, 0.6, 0.45], metalness: 0.1, gloss: 0.3 },
				scale: [2.5, 0.3, 2.0],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'ontology:instance',
			description: 'Amber specimen sphere for instances — amber gold',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.9, 0.7, 0.3], metalness: 0.4, gloss: 0.7 },
				scale: [0.8, 0.8, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'ontology:property',
			description: 'Thin capsule pillar for properties — slate blue-gray',
			template: {
				components: { render: { type: 'capsule', castShadows: true } },
				material: { diffuse: [0.5, 0.55, 0.65], metalness: 0.2, gloss: 0.4 },
				scale: [0.3, 1.2, 0.3],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'ontology:process',
			description: 'Spinning torus for processes — copper',
			template: {
				components: { render: { type: 'torus', castShadows: true } },
				material: { diffuse: [0.7, 0.45, 0.25], metalness: 0.5, gloss: 0.6 },
				scale: [0.8, 0.8, 0.8],
				animate: { type: 'rotate', axis: 'y', speed: 0.15 },
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'Classify each concept by what it IS: a general category, a specific instance, a property or attribute, or a process/event. Ignore relations; focus on nature.',

	render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[] {
		const nodes = schema.nodes || [];
		const edges = schema.edges || [];

		// Group nodes by role for positioning
		const roleGroups = new Map<string, typeof nodes>();
		for (const node of nodes) {
			const role = node.modeRole ?? 'default';
			if (!roleGroups.has(role)) roleGroups.set(role, []);
			roleGroups.get(role)!.push(node);
		}

		// Compute position for each node
		const nodePositions = new Map<string, [number, number, number]>();
		for (const [role, group] of roleGroups) {
			group.forEach((node, i) => {
				nodePositions.set(node.id, positionForRole(role, i, group.length));
			});
		}

		// --- Environment layer ---
		const envEntities: EntitySpec[] = [
			{
				id: 'ground',
				components: { render: { type: 'plane' } },
				position: [0, 0, 0],
				scale: [20, 1, 20],
				material: {
					diffuse: GROUND_COLOR,
					opacity: 0.6,
					blendType: 'normal',
				},
			},
			{
				id: 'ambient-light',
				components: {
					light: {
						type: 'omni',
						color: [1.0, 0.95, 0.85],
						intensity: 0.8,
						range: 30,
						castShadows: true,
					},
				},
				position: [4, 7, -2],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `ontology:${role}` : 'ontology:category';

			// Scale by weight
			const s = 0.7 + weight * 0.6;

			return {
				id: node.id,
				prefab,
				components: {},
				position: pos as [number, number, number],
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

		// --- Connections layer ---
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
					diffuse: EDGE_COLOR,
					opacity: 0.3 + strength * 0.4,
					blendType: 'normal' as const,
				},
				label: edge.label,
			};
		});

		return [
			makeLayer({ name: 'Environment', entities: envEntities, position: 'a' }),
			makeLayer({ name: 'Concepts', entities: conceptEntities, position: 'n' }),
			makeLayer({ name: 'Connections', entities: connectionEntities, position: 'z' }),
		];
	},
};
