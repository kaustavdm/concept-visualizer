import type { AnimationDSL } from './animation-dsl';
import type { VisualizationSchema } from '$lib/types';

// --- PlayCanvas-aligned component specs (typed subset + passthrough) ---

export interface RenderComponentSpec {
	type: 'sphere' | 'box' | 'plane' | 'cone' | 'cylinder' | 'torus' | 'capsule';
	castShadows?: boolean;
	receiveShadows?: boolean;
	geometry?: {
		type: 'cone';
		capSegments: number;
		baseRadius: number;
		peakRadius: number;
		height: number;
		heightSegments: number;
	};
	[key: string]: unknown;
}

export interface LightComponentSpec {
	type: 'directional' | 'omni' | 'spot';
	color?: [number, number, number];
	intensity?: number;
	range?: number;
	castShadows?: boolean;
	shadowResolution?: number;
	innerConeAngle?: number;
	outerConeAngle?: number;
	[key: string]: unknown;
}

export interface MaterialSpec {
	diffuse?: [number, number, number];
	emissive?: [number, number, number];
	specular?: [number, number, number];
	metalness?: number;
	gloss?: number;
	opacity?: number;
	blendType?: 'normal' | 'additive' | 'none';
	[key: string]: unknown;
}

export interface TextComponentSpec {
	text: string;
	fontSize?: number;
	color?: [number, number, number];
	background?: [number, number, number];
	backgroundOpacity?: number;
	align?: 'center' | 'left' | 'right';
	billboard?: boolean;
	maxWidth?: number;
}

export interface EntitySpec {
	id: string;
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: [number, number, number];

	components: {
		render?: RenderComponentSpec;
		light?: LightComponentSpec;
		text?: TextComponentSpec;
	};

	material?: MaterialSpec;
	children?: EntitySpec[];
	prefab?: string;
	animate?: AnimationDSL;
	tags?: string[];
	followable?: boolean;
	themeResponse?: {
		light?: Partial<MaterialSpec>;
		dark?: Partial<MaterialSpec>;
	};

	label?: string;
	weight?: number;
	details?: string;
}

// --- Layer & Scene (CRDT-ready) ---

export type LayerSource =
	| { type: 'chat'; messageId: string }
	| { type: 'manual' }
	| { type: 'import'; format: string }
	| { type: 'clone'; sourceLayerId: string };

export interface Layer3d {
	id: string;
	name: string;
	visible: boolean;
	entities: EntitySpec[];
	text: string;
	position: string;
	source: LayerSource;
	createdAt: string;
	updatedAt: string;
	observationMode?: string;
}

export interface ChatMessage {
	id: string;
	text: string;
	timestamp: string;
	layerIds: string[];
	observationMode?: string;
	schema?: VisualizationSchema;
}

/** Full point-in-time snapshot for undo/restore. Stores complete layer copies. */
export interface VersionSnapshot {
	version: number;
	timestamp: string;
	layers: Layer3d[];
	description: string;
	tier?: number;
	messageId?: string;
}

export interface Scene3d {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	layers: Layer3d[];
	environment?: {
		ambientColor?: [number, number, number];
		clearColor?: [number, number, number];
		fog?: {
			type: 'none' | 'linear' | 'exp' | 'exp2';
			color?: [number, number, number];
			density?: number;
		};
	};
	camera?: {
		mode: 'orbit' | 'fly' | 'follow';
		position: [number, number, number];
		target?: string;
	};
	version: number;
	messages?: ChatMessage[];
	snapshots?: VersionSnapshot[];
	metadata?: Record<string, unknown>;
}
