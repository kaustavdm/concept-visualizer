// src/lib/3d/observation-modes/debate.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';

/**
 * Debate observation mode — Boxing ring dialectic.
 *
 * Roles: position, counter, resolution, tension, ground
 * Layout: opposing poles on a plane. Positions left (-X), counters right (+X),
 *         resolutions centered between them, tensions elevated, ground at base.
 * Visual: Boxing ring arena. Blue podiums vs red podiums, mirror symmetry.
 *         Purple resolution spheres between. Dramatic overhead spotlight.
 */

// Edge color: neutral gray
const EDGE_COLOR: [number, number, number] = [0.45, 0.45, 0.45];

// Arena ground color: dark warm brown
const GROUND_COLOR: [number, number, number] = [0.18, 0.16, 0.14];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'debate',
		...partial,
	};
}

/**
 * Spread nodes of the same role along the Z-axis, centered around Z=0.
 */
function spreadZ(indexInRole: number, countInRole: number): number {
	if (countInRole <= 1) return 0;
	const spacing = 2.5;
	const totalSpan = (countInRole - 1) * spacing;
	return -totalSpan / 2 + indexInRole * spacing;
}

/**
 * Position a node based on its modeRole.
 * Nodes of the same role spread along the Z-axis.
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	const z = spreadZ(indexInRole, countInRole);

	switch (role) {
		case 'position':
			return [-4, 1.5, z];

		case 'counter':
			return [4, 1.5, z];

		case 'resolution':
			return [0, 1.5, z];

		case 'tension':
			return [0, 3, z];

		case 'ground':
			return [0, 0.3, z];

		default:
			return [0, 1.5, z];
	}
}

export const debateMode: ObservationMode = {
	id: 'debate',
	name: 'Debate',
	description: 'Boxing ring dialectic with opposing positions, counter-positions, resolutions, and tensions',

	roles: [
		{ id: 'position', label: 'Position', description: 'A stance or thesis being argued', prefab: 'debate:position', relevance: 'high' },
		{ id: 'counter', label: 'Counter', description: 'An opposing stance or antithesis', prefab: 'debate:counter', relevance: 'high' },
		{ id: 'resolution', label: 'Resolution', description: 'A synthesis or compromise between opposing views', prefab: 'debate:resolution', relevance: 'high' },
		{ id: 'tension', label: 'Tension', description: 'An unresolved conflict or paradox', prefab: 'debate:tension', relevance: 'medium' },
		{ id: 'ground', label: 'Ground', description: 'Shared assumptions both sides accept', prefab: 'debate:ground', relevance: 'medium' },
	],

	prefabs: [
		{
			id: 'debate:position',
			description: 'Bold blue podium for positions',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.3, 0.45, 0.85], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.5, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'debate:counter',
			description: 'Bold red podium for counter-positions',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.85, 0.35, 0.3], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.5, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'debate:resolution',
			description: 'Purple sphere for resolutions',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.6, 0.35, 0.8], metalness: 0.4, gloss: 0.7 },
				scale: [1.2, 1.2, 1.2],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'debate:tension',
			description: 'Emissive amber sphere for unresolved tensions',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.9, 0.7, 0.3], emissive: [0.3, 0.2, 0.05], metalness: 0.3, gloss: 0.5 },
				scale: [0.8, 0.8, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'debate:ground',
			description: 'Neutral stone platform for shared ground',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.6, 0.58, 0.55], metalness: 0.1, gloss: 0.3 },
				scale: [2.0, 0.2, 1.5],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'Find opposing views. Is this a position? A counter-position? A resolution? Unresolved tension? Shared ground both sides assume?',

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
				id: 'arena-ring',
				components: { render: { type: 'torus' } },
				position: [0, 0, 0],
				scale: [10, 0.3, 10],
				material: {
					diffuse: [0.4, 0.35, 0.3],
					opacity: 0.5,
					blendType: 'normal',
				},
			},
			{
				id: 'ground',
				components: { render: { type: 'plane' } },
				position: [0, 0, 0],
				scale: [20, 1, 20],
				material: {
					diffuse: GROUND_COLOR,
					opacity: 0.5,
					blendType: 'normal',
				},
			},
			{
				id: 'overhead-light',
				components: {
					light: {
						type: 'omni',
						color: [1.0, 0.95, 0.9],
						intensity: 1.2,
						range: 25,
						castShadows: true,
					},
				},
				position: [0, 10, 0],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1.5, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `debate:${role}` : 'debate:position';

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
