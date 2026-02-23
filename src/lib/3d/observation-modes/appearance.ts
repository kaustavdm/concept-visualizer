// src/lib/3d/observation-modes/appearance.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';

/**
 * Appearance observation mode — Two-plane parallax (magician's parlor / X-ray lab).
 *
 * Roles: surface, depth, lens, veil, marker
 * Layout: translucent surface plane above (Y=4), opaque depth plane below (Y=0.5).
 *         Lens columns at mid-height (Y=2) connecting planes.
 *         Veils as semi-transparent barriers (Y=3).
 *         Markers as gold clue spheres (Y=1.5).
 * Story focus: surface appearance vs. deeper reality, lenses that reveal, veils that obscure.
 */

// Edge color: soft mauve-gray
const EDGE_COLOR: [number, number, number] = [0.5, 0.4, 0.5];

function makeLayer(partial: Partial<Layer3d> & { name: string; entities: EntitySpec[] }): Layer3d {
	return {
		id: uuid(),
		visible: true,
		text: '',
		position: 'n',
		source: { type: 'manual' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		observationMode: 'appearance',
		...partial,
	};
}

/**
 * Position a node based on its modeRole.
 * Nodes of the same role spread in a ring around their designated Y level, radius ~3.
 */
function positionForRole(
	role: string | undefined,
	indexInRole: number,
	countInRole: number,
): [number, number, number] {
	const angle = countInRole > 1
		? (2 * Math.PI * indexInRole) / countInRole
		: 0;
	const radius = 3;

	switch (role) {
		case 'surface':
			return [Math.cos(angle) * radius, 4, Math.sin(angle) * radius];

		case 'depth':
			return [Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius];

		case 'lens':
			return [Math.cos(angle) * radius, 2, Math.sin(angle) * radius];

		case 'veil':
			return [Math.cos(angle) * radius, 3, Math.sin(angle) * radius];

		case 'marker':
			return [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius];

		default:
			return [Math.cos(angle) * radius, 2, Math.sin(angle) * radius];
	}
}

export const appearanceMode: ObservationMode = {
	id: 'appearance',
	name: 'Appearance',
	description: 'Two-plane parallax revealing surface appearances vs. deeper realities, with lenses, veils, and markers',

	roles: [
		{ id: 'surface', label: 'Surface', description: 'A surface appearance or facade', prefab: 'appearance:surface', relevance: 'high' },
		{ id: 'depth', label: 'Depth', description: 'A deeper reality beneath appearances', prefab: 'appearance:depth', relevance: 'high' },
		{ id: 'lens', label: 'Lens', description: 'A way of seeing deeper, connecting surface and depth', prefab: 'appearance:lens', relevance: 'medium' },
		{ id: 'veil', label: 'Veil', description: 'Something that obscures understanding', prefab: 'appearance:veil', relevance: 'medium' },
		{ id: 'marker', label: 'Marker', description: 'A clue revealing hidden depth', prefab: 'appearance:marker', relevance: 'low' },
	],

	prefabs: [
		{
			id: 'appearance:surface',
			description: 'Parchment facade box — warm parchment tone',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.85, 0.78, 0.65], metalness: 0.1, gloss: 0.3 },
				scale: [1.8, 0.3, 1.2],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'appearance:depth',
			description: 'Dense indigo sphere — opaque depth reality',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.2, 0.2, 0.55], metalness: 0.4, gloss: 0.7 },
				scale: [1.2, 1.2, 1.2],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'appearance:lens',
			description: 'Clear blue capsule column — lens connecting planes',
			template: {
				components: { render: { type: 'capsule', castShadows: true } },
				material: { diffuse: [0.5, 0.7, 0.9], metalness: 0.3, gloss: 0.8 },
				scale: [0.4, 2.0, 0.4],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'appearance:veil',
			description: 'Semi-transparent mauve curtain — obscuring barrier',
			template: {
				components: { render: { type: 'box', castShadows: true } },
				material: { diffuse: [0.6, 0.4, 0.6], metalness: 0.1, gloss: 0.3, opacity: 0.5, blendType: 'normal' },
				scale: [2.0, 1.5, 0.1],
			},
			slots: ['label', 'weight'],
		},
		{
			id: 'appearance:marker',
			description: 'Small gold emissive sphere — clue marker',
			template: {
				components: { render: { type: 'sphere', castShadows: true } },
				material: { diffuse: [0.9, 0.8, 0.3], emissive: [0.2, 0.15, 0.0], metalness: 0.5, gloss: 0.7 },
				scale: [0.5, 0.5, 0.5],
			},
			slots: ['label', 'weight'],
		},
	],

	storyFocus: 'For each concept: is it a surface appearance, a deeper reality, a lens for seeing deeper, something that obscures understanding, or a clue revealing hidden depth?',

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
				id: 'upper-plane',
				components: { render: { type: 'plane' } },
				position: [0, 4.5, 0],
				scale: [18, 1, 18],
				material: {
					diffuse: [0.8, 0.75, 0.65],
					opacity: 0.15,
					blendType: 'normal',
				},
			},
			{
				id: 'lower-plane',
				components: { render: { type: 'plane' } },
				position: [0, 0, 0],
				scale: [18, 1, 18],
				material: {
					diffuse: [0.15, 0.15, 0.3],
					opacity: 0.4,
					blendType: 'normal',
				},
			},
			{
				id: 'warm-overhead-light',
				components: {
					light: {
						type: 'omni',
						color: [1.0, 0.9, 0.8],
						intensity: 0.8,
						range: 25,
						castShadows: true,
					},
				},
				position: [2, 8, -2],
			},
			{
				id: 'cool-underlight',
				components: {
					light: {
						type: 'omni',
						color: [0.6, 0.65, 0.9],
						intensity: 0.4,
						range: 15,
					},
				},
				position: [-2, -2, 2],
			},
		];

		// --- Concepts layer ---
		const conceptEntities: EntitySpec[] = nodes.map((node) => {
			const pos = nodePositions.get(node.id) ?? [0, 2, 0];
			const weight = node.weight ?? 0.5;
			const role = node.modeRole ?? 'default';
			const prefab = role !== 'default' ? `appearance:${role}` : 'appearance:surface';

			// Scale by weight
			const s = 0.7 + weight * 0.6;

			return {
				id: node.id,
				prefab,
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
