import type { SceneEntitySpec, MaterialSpec } from './scene-content.types';
import type { AnimationDSL } from './animation-dsl';
import type { CameraMode } from './createScene';

/** A serializable entity spec — uses AnimationDSL instead of callback */
export interface SerializableEntitySpec extends Omit<SceneEntitySpec, 'animate'> {
  animate?: AnimationDSL;
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };
}

/** A composable layer of entities */
export interface Layer3d {
  id: string;
  name: string;
  visible: boolean;
  text: string;
  audioBlob?: Blob;
  entities: SerializableEntitySpec[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A persistable 3D scene file */
export interface File3d {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  layers: Layer3d[];
  camera?: {
    mode: CameraMode;
    position: [number, number, number];
    target?: string;
  };
  theme: 'light' | 'dark';
  metadata?: Record<string, unknown>;
}
