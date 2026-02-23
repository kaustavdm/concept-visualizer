// src/lib/3d/observation-modes/morality.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';

/**
 * Morality observation mode — Caravaggio-lit tension web.
 *
 * Roles: agent, affected, duty, value, consequence, tension
 * Layout: tension at center, agents +X, affected -X, values upward,
 *         duties in mid-height ring, consequences at bottom.
 * Visual: warm amber light, capsules/slabs/cones/torus shapes,
 *         exp2 fog, Caravaggio-style dramatic lighting.
 */

// Edge color: warm amber
const EDGE_COLOR: [number, number, number] = [0.6, 0.45, 0.25];

// Ground color: dark walnut
const GROUND_COLOR: [number, number, number] = [0.15, 0.12, 0.1];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'morality',
		...partial,
	};
}

/**
 * Position a node based on its modeRole.
 * Multiple nodes of the same role spread out along the designated area.
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	switch (role) {
		case 'tension':
			return [0, 1.5, 0];

		case 'agent': {
			// +X side, spread along X=3..6
			const spread = countInRole > 1 ? (indexInRole / (countInRole - 1)) * 3 : 0;
			const z = countInRole > 1 ? (indexInRole - (countInRole - 1) / 2) * 1.5 : 0;
			return [3 + spread, 1.5, z];
		}

		case 'affected': {
			// -X side, spread along X=-3..-6
			const spread = countInRole > 1 ? (indexInRole / (countInRole - 1)) * 3 : 0;
			const z = countInRole > 1 ? (indexInRole - (countInRole - 1) / 2) * 1.5 : 0;
			return [-(3 + spread), 1.5, z];
		}

		case 'value': {
			// Radiate upward Y=3..5, spread on XZ
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2;
			const y = 3 + (countInRole > 1 ? (indexInRole / (countInRole - 1)) * 2 : 1);
			return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
		}

		case 'duty': {
			// Mid-height ring Y=2, spread in a circle
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 3;
			return [Math.cos(angle) * radius, 2, Math.sin(angle) * radius];
		}

		case 'consequence': {
			// Bottom Y=0.5, spread on XZ
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2.5;
			return [Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius];
		}

		default: {
			// No role — scattered on Y=1
			const angle = countInRole > 1
				? (2 * Math.PI * indexInRole) / countInRole
				: 0;
			const radius = 2;
			return [Math.cos(angle) * radius, 1, Math.sin(angle) * radius];
		}
	}
}

export const moralityMode: ObservationMode = {
	id: 'morality',
	name: 'Morality',
	description: 'Tension-web of moral agents, duties, values, and consequences with Caravaggio lighting',

	roles: [
		{ id: 'agent', label: 'Agent', description: 'Someone who acts or makes moral choices', prefab: 'morality:agent', relevance: 'high' },
		{ id: 'affected', label: 'Affected', description: 'Someone impacted by moral actions', prefab: 'morality:affected', relevance: 'high' },
		{ id: 'duty', label: 'Duty', description: 'An obligation or moral imperative', prefab: 'morality:duty', relevance: 'high' },
		{ id: 'value', label: 'Value', description: 'A moral value or ethical principle', prefab: 'morality:value', relevance: 'medium' },
		{ id: 'consequence', label: 'Consequence', description: 'An outcome or result of moral action', prefab: 'morality:consequence', relevance: 'medium' },
		{ id: 'tension', label: 'Tension', description: 'A conflict between competing moral demands', prefab: 'morality:tension', relevance: 'low' },
	],

	prefabs: [
		{
			id: 'morality:agent',
			description: 'Capsule for moral agents — warm skin tone',
			template: {
				components: { render: { type: 'capsule', castShadows: true } },
				material: { diffuse: [0.85, 0.65, 0.45], metalness: 0.2, gloss: 0.6 },
				scale: [0.8, 1.2, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'morality:affected',
			description: 'Capsule for affected parties — muted blue',
			template: {
				components: { render: { type: 'capsule', castShadows: true } },
				material: { diffuse: [0.45, 0.55, 0.75], metalness: 0.1, gloss: 0.6 },
				scale: [0.8, 1.0, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'morality:duty',
			description: 'Stone slab (box) for duties — warm gray',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.6, 0.55, 0.5], metalness: 0.1, gloss: 0.3 },
				scale: [1.2, 0.4, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'morality:value',
			description: 'Gold cone for moral values',
			template: {
				components: { render: { type: 'cone', castShadows: true } },
				material: { diffuse: [0.9, 0.75, 0.3], metalness: 0.7, gloss: 0.8 },
				scale: [0.6, 1.0, 0.6],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'morality:consequence',
			description: 'Torus ripple for consequences — muted red',
			template: {
				components: { render: { type: 'torus', castShadows: true } },
				material: { diffuse: [0.7, 0.35, 0.3], metalness: 0.3, gloss: 0.6 },
				scale: [0.8, 0.8, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'morality:tension',
			description: 'Emissive sphere for moral tension — deep amber-red',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.8, 0.4, 0.2], emissive: [0.3, 0.15, 0.05], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.0, 1.0],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'For each concept, ask: is this someone who acts? Someone affected? A duty or obligation? A moral value? A consequence? A tension between competing demands?',

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
						color: [1.0, 0.85, 0.6],
						intensity: 0.8,
						range: 30,
						castShadows: true,
					},
				},
				position: [5, 8, -3],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `morality:${role}` : 'morality:agent';

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
				scale: [thickness, thickness, length] as [number, number, number],
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
