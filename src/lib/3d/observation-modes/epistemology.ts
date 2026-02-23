// src/lib/3d/observation-modes/epistemology.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';
import { computeEdgeRotation } from './edge-utils';

/**
 * Epistemology observation mode — Sci-fi observatory with concentric certainty rings.
 *
 * Roles: claim, evidence, means, assumption, limit
 * Layout: concentric rings — certain concepts near center, uncertain at periphery.
 *         Claims and evidence on inner rings, means and assumptions on mid ring,
 *         limits on outer ring. Size scaled by importance weight.
 * Visual: no ground plane, three torus rings, deep space backdrop,
 *         cool white lighting, diamond-oriented boxes for claims,
 *         inverted cones for assumptions, barrier planes for limits.
 */

// Edge color: faint cyan
const EDGE_COLOR: [number, number, number] = [0.4, 0.5, 0.6];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'epistemology',
		...partial,
	};
}

/** Ring radius and Y-height for each role. */
interface RingPlacement {
	radius: number;
	y: number;
}

function ringForRole(role: string | undefined): RingPlacement {
	switch (role) {
		case 'claim':
			return { radius: 2, y: 2 };
		case 'evidence':
			return { radius: 3, y: 1.5 };
		case 'means':
			return { radius: 5, y: 2 };
		case 'assumption':
			return { radius: 4, y: 0.5 };
		case 'limit':
			return { radius: 7, y: 1.5 };
		default:
			return { radius: 4, y: 1.5 };
	}
}

/**
 * Position a node on its concentric ring.
 * Nodes of the same role spread evenly around the ring.
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	const { radius, y } = ringForRole(role);
	const angle = countInRole > 1
		? (2 * Math.PI * indexInRole) / countInRole
		: 0;
	return [
		Math.cos(angle) * radius,
		y,
		Math.sin(angle) * radius,
	];
}

export const epistemologyMode: ObservationMode = {
	id: 'epistemology',
	name: 'Epistemology',
	description: 'Concentric certainty rings in a sci-fi observatory — claims at center, limits at periphery',

	roles: [
		{ id: 'claim', label: 'Claim', description: 'A knowledge claim or proposition held to be true', prefab: 'epistemology:claim', relevance: 'high' },
		{ id: 'evidence', label: 'Evidence', description: 'Data, observation, or reasoning that supports or undermines a claim', prefab: 'epistemology:evidence', relevance: 'high' },
		{ id: 'means', label: 'Means', description: 'A method or way of knowing (perception, reason, testimony)', prefab: 'epistemology:means', relevance: 'medium' },
		{ id: 'assumption', label: 'Assumption', description: 'An unexamined belief taken for granted', prefab: 'epistemology:assumption', relevance: 'medium' },
		{ id: 'limit', label: 'Limit', description: 'A boundary on what can be known or verified', prefab: 'epistemology:limit', relevance: 'low' },
	],

	prefabs: [
		{
			id: 'epistemology:claim',
			description: 'Diamond-oriented box for claims — ice blue',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.6, 0.75, 0.95], metalness: 0.5, gloss: 0.8 },
				rotation: [0, 0, 45],
				scale: [0.8, 0.8, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'epistemology:evidence',
			description: 'Sphere for evidence — emerald',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.3, 0.75, 0.5], metalness: 0.3, gloss: 0.6 },
				scale: [0.8, 0.8, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'epistemology:means',
			description: 'Capsule for means of knowing — silver',
			template: {
				components: { render: { type: 'capsule', castShadows: true } },
				material: { diffuse: [0.7, 0.7, 0.75], metalness: 0.6, gloss: 0.7 },
				scale: [0.6, 1.0, 0.6],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'epistemology:assumption',
			description: 'Inverted cone for assumptions — dull orange',
			template: {
				components: { render: { type: 'cone', castShadows: true } },
				material: { diffuse: [0.8, 0.6, 0.3], metalness: 0.2, gloss: 0.4 },
				rotation: [180, 0, 0],
				scale: [0.8, 1.0, 0.8],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'epistemology:limit',
			description: 'Flat barrier plane for limits — dark red-gray',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.55, 0.3, 0.3], metalness: 0.1, gloss: 0.3 },
				scale: [2.0, 1.5, 0.1],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'Treat each concept as part of knowledge. Is it a claim? Evidence? A means of knowing? An unexamined assumption? A limit on what can be known?',

	render(schema: VisualizationSchema, _options?: RenderOptions): Layer3d[] {
		const nodes = schema.nodes || [];
		const edges = schema.edges || [];

		// Group nodes by role for ring positioning
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

		// --- Environment layer: three concentric torus rings + cool white light ---
		const envEntities: EntitySpec[] = [
			{
				id: 'ring-1',
				components: { render: { type: 'torus' } },
				position: [0, 0, 0],
				scale: [4, 0.1, 4],
				material: {
					diffuse: [0.3, 0.35, 0.5],
					opacity: 0.4,
					blendType: 'normal',
				},
			},
			{
				id: 'ring-2',
				components: { render: { type: 'torus' } },
				position: [0, 0, 0],
				scale: [8, 0.1, 8],
				material: {
					diffuse: [0.25, 0.3, 0.45],
					opacity: 0.3,
					blendType: 'normal',
				},
			},
			{
				id: 'ring-3',
				components: { render: { type: 'torus' } },
				position: [0, 0, 0],
				scale: [14, 0.1, 14],
				material: {
					diffuse: [0.2, 0.25, 0.4],
					opacity: 0.2,
					blendType: 'normal',
				},
			},
			{
				id: 'observatory-light',
				components: {
					light: {
						type: 'omni',
						color: [0.85, 0.9, 1.0],
						intensity: 1.0,
						range: 30,
						castShadows: true,
					},
				},
				position: [0, 8, 0],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 1.5, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `epistemology:${role}` : 'epistemology:claim';

			// Scale by weight
			const s = 0.7 + weight * 0.6;

			// Certainty-as-opacity: uncertain concepts are more transparent
			const certainty = node.weight ?? 0.5;
			const opacity = 0.4 + certainty * 0.6; // range 0.4–1.0

			return {
				id: node.id,
				prefab,
				components: {},
				position: pos as [number, number, number],
				scale: [s, s, s] as [number, number, number],
				material: { opacity, blendType: opacity < 1 ? 'normal' as const : undefined },
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
