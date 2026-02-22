// src/lib/3d/observation-modes/graph.ts
import type { ObservationMode, RenderOptions } from './types';
import type { VisualizationSchema } from '$lib/types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import { v4 as uuid } from 'uuid';

// Color palette for concept themes
const THEME_COLORS: Record<string, [number, number, number]> = {
	core: [80, 140, 255],
	support: [120, 200, 120],
	context: [200, 160, 80],
	outcome: [200, 80, 120],
	default: [150, 150, 180],
};

function getThemeColor(theme?: string): [number, number, number] {
	return THEME_COLORS[theme ?? 'default'] ?? THEME_COLORS.default;
}

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
				diffuse: options?.theme === 'dark' ? [30, 30, 40] : [220, 225, 230],
				opacity: 0.5,
				blendType: 'normal',
			},
		}];

		// Concepts layer — one sphere per node
		const conceptEntities: EntitySpec[] = nodes.map(node => {
			const pos = nodePositions.get(node.id) ?? [0, 1, 0];
			const weight = node.weight ?? 0.5;
			const s = 0.5 + weight * 1.5;
			const color = getThemeColor(node.theme);

			return {
				id: node.id,
				components: { render: { type: 'sphere' as const, castShadows: true } },
				position: pos,
				scale: [s, s, s] as [number, number, number],
				material: { diffuse: color, metalness: 0.3, gloss: 0.6 },
				label: node.label,
				weight: node.weight,
				details: node.details,
				tags: node.theme ? [node.theme] : [],
				followable: true,
			};
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
				scale: [thickness, thickness, length] as [number, number, number],
				material: {
					diffuse: [100, 100, 120] as [number, number, number],
					opacity: 0.3 + strength * 0.4,
					blendType: 'normal' as const,
				},
				label: edge.label,
			};
		});

		return [
			makeLayer({ name: 'Ground', entities: groundEntities, position: 'a' }),
			makeLayer({ name: 'Concepts', entities: conceptEntities, position: 'n' }),
			makeLayer({ name: 'Connections', entities: connectionEntities, position: 'z' }),
		];
	},
};
