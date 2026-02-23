import type * as pc from 'playcanvas';

/** Per-frame animation context passed to each entity's animate function */
export interface AnimationContext {
  time: number;
  dt: number;
  entities: Record<string, pc.Entity>;
}

/** Material specification — maps directly to pc.StandardMaterial properties */
export interface MaterialSpec {
  diffuse: [number, number, number];
  emissive?: [number, number, number];
  specular?: [number, number, number];
  metalness?: number;
  gloss?: number;
  opacity?: number;
  blendType?: 'normal' | 'additive' | 'none';
}

/** A single entity in the scene */
export interface SceneEntitySpec {
  id: string;
  mesh:
    | 'sphere'
    | 'box'
    | 'plane'
    | 'cone'
    | 'cylinder'
    | 'torus'
    | 'capsule'
    | {
        type: 'cone';
        capSegments: number;
        baseRadius: number;
        peakRadius: number;
        height: number;
        heightSegments: number;
      };
  material: MaterialSpec;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  /** Opacity settings for transparent materials (grid floor, etc.) */
  opacity?: { map: 'grid'; tiling: number; blend: true };
  /** Per-frame animation — receives the entity + context, mutates position/rotation */
  animate?: (entity: pc.Entity, ctx: AnimationContext) => void;
  /** Whether the camera can follow this entity (only entities with motion) */
  followable?: boolean;
  /** Parent entity ID for hierarchical nesting */
  parent?: string;
  /** PlayCanvas-aligned component bag (forward-compatible with EntitySpec) */
  components?: {
    render?: { type: string; [key: string]: unknown };
    light?: { type: string; [key: string]: unknown };
    text?: { text: string; [key: string]: unknown };
  };
  /** Human-readable label for concept visualization */
  label?: string;
  /** 0–1 importance weight (preserved from VisualizationNode) */
  weight?: number;
  /** 1-2 sentence description (preserved from VisualizationNode) */
  details?: string;
  /** Semantic tags for filtering and grouping */
  tags?: string[];
  /** Per-entity theme-responsive material overrides (serializable alternative to scene-level onThemeChange) */
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };
}

/** Environment settings for the scene (fog, ambient, clear color) */
export interface SceneEnvironment {
  fog?: { type: 'none' | 'linear' | 'exp' | 'exp2'; color?: [number, number, number]; density?: number };
  ambientColor?: [number, number, number];
  clearColor?: [number, number, number];
}

/** Complete scene content definition */
export interface SceneContent {
  id: string;
  name: string;
  entities: SceneEntitySpec[];
  /** Optional scene environment overrides (fog, ambient, etc.) */
  environment?: SceneEnvironment;
  /** Optional theme-responsive material overrides (called on theme change) */
  onThemeChange?: (
    theme: 'light' | 'dark',
    entities: Record<string, pc.Entity>,
  ) => void;
}
