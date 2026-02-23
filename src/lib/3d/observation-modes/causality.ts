// src/lib/3d/observation-modes/causality.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';

/**
 * Causality observation mode — River rapids directed flow.
 *
 * Roles: cause, effect, mechanism, purpose, condition
 * Layout: directed flow upstream (Z=-6) to downstream (Z=+6).
 *         Cones point downstream for causes, torus gears for mechanisms,
 *         gate boxes for conditions, spheres for effects, upward cones for purpose.
 * Visual: Warm upstream, cool downstream. Amber-gray edge connections.
 */

const EDGE_COLOR: [number, number, number] = [0.55, 0.45, 0.35];

const GROUND_COLOR: [number, number, number] = [0.25, 0.2, 0.15];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'causality',
		...partial,
	};
}

/**
 * Spread nodes of the same role along the X-axis, centered around X=0.
 * Spacing is ~2.5 units between nodes.
 */
function spreadOnX(indexInRole: number, countInRole: number): number {
	if (countInRole <= 1) return 0;
	const totalWidth = (countInRole - 1) * 2.5;
	return -totalWidth / 2 + indexInRole * 2.5;
}

/**
 * Position a node based on its modeRole.
 * Directed Z-flow: causes upstream (negative Z), effects downstream (positive Z).
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	const x = spreadOnX(indexInRole, countInRole);

	switch (role) {
		case 'cause':
			return [x, 1.5, -6];

		case 'effect':
			return [x, 1.5, 6];

		case 'mechanism':
			return [x, 2.5, 0];

		case 'purpose':
			return [x, 3.5, 3];

		case 'condition':
			return [x, 1, -3];

		default:
			return [x, 1.5, 0];
	}
}

export const causalityMode: ObservationMode = {
	id: 'causality',
	name: 'Causality',
	description: 'Directed cause-effect flow with warm upstream and cool downstream, river rapids metaphor',

	roles: [
		{ id: 'cause', label: 'Cause', description: 'An origin or source that produces an effect', prefab: 'causality:cause', relevance: 'high' },
		{ id: 'effect', label: 'Effect', description: 'An outcome or result produced by a cause', prefab: 'causality:effect', relevance: 'high' },
		{ id: 'mechanism', label: 'Mechanism', description: 'A process or means explaining how cause leads to effect', prefab: 'causality:mechanism', relevance: 'high' },
		{ id: 'purpose', label: 'Purpose', description: 'A goal or intended outcome motivating the causal chain', prefab: 'causality:purpose', relevance: 'medium' },
		{ id: 'condition', label: 'Condition', description: 'A necessary prerequisite or gate for a causal relationship', prefab: 'causality:condition', relevance: 'medium' },
	],

	prefabs: [
		{
			id: 'causality:cause',
			description: 'Downstream-pointing cone for causes — warm red-amber',
			template: {
				components: { render: { type: 'cone', castShadows: true } },
				material: { diffuse: [0.85, 0.5, 0.25], metalness: 0.3, gloss: 0.5 },
				scale: [0.8, 1.2, 0.8],
				rotation: [-90, 0, 0],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'causality:effect',
			description: 'Sphere for effects — cool teal',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.3, 0.65, 0.75], metalness: 0.3, gloss: 0.6 },
				scale: [1.0, 1.0, 1.0],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'causality:mechanism',
			description: 'Torus gear for mechanisms — copper metallic',
			template: {
				components: { render: { type: 'torus', castShadows: true } },
				material: { diffuse: [0.65, 0.45, 0.3], metalness: 0.7, gloss: 0.7 },
				scale: [0.9, 0.9, 0.9],
				animate: { type: 'rotate', axis: 'y', speed: 0.2 },
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'causality:purpose',
			description: 'Upward-pointing cone for purposes — gold',
			template: {
				components: { render: { type: 'cone', castShadows: true } },
				material: { diffuse: [0.9, 0.8, 0.4], metalness: 0.4, gloss: 0.6 },
				scale: [0.7, 1.0, 0.7],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'causality:condition',
			description: 'Tall thin gate box for conditions — stone gray',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.55, 0.55, 0.5], metalness: 0.1, gloss: 0.3 },
				scale: [0.4, 1.5, 0.4],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'Trace cause and effect. Is this a cause? An effect? A mechanism explaining how? A purpose or goal? A necessary condition?',

	render(schema: VisualizationSchema, _options?: RenderOptions): Layer3d[] {
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
				scale: [20, 1, 30],
				material: {
					diffuse: GROUND_COLOR,
					opacity: 0.5,
					blendType: 'normal',
				},
			},
			{
				id: 'warm-light',
				components: {
					light: {
						type: 'omni',
						color: [1.0, 0.85, 0.65],
						intensity: 0.9,
						range: 30,
						castShadows: true,
					},
				},
				position: [-3, 7, -8],
			},
			{
				id: 'cool-light',
				components: {
					light: {
						type: 'omni',
						color: [0.7, 0.85, 1.0],
						intensity: 0.5,
						range: 20,
					},
				},
				position: [3, 5, 8],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `causality:${role}` : 'causality:cause';

			const s = 0.7 + weight * 0.6;

			const entity: EntitySpec = {
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
						position: [0, 1.4, 0] as [number, number, number],
						scale: [1.5, 1.5, 1.5] as [number, number, number],
					},
				],
			};

			// Mechanism entities get rotate animation
			if (role === 'mechanism') {
				entity.animate = { type: 'rotate', axis: 'y', speed: 0.2 };
			}

			return entity;
		});

		// --- Connections layer ---
		const connectionEntities: EntitySpec[] = edges.map((edge) => {
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
