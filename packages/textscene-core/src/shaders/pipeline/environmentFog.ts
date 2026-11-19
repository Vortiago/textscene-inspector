import type * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import type { FogMode } from '../../godot/rendering/environment/depthFog.js';

/** The environment's fog as Godot's scene data and sky data read it (`render_scene_data_rd.cpp:208-225`). */
export interface EnvironmentFog {
  /** The fog light colour, linear. */
  readonly lightColor: THREE.Color;
  readonly lightEnergy: number;
  readonly mode: EnumValue<typeof FogMode>;
  readonly density: number;
  readonly height: number;
  readonly heightDensity: number;
  readonly depthCurve: number;
  readonly depthBegin: number;
  /** 0 or less ends the depth fog at the camera's far plane. */
  readonly depthEnd: number;
  readonly sunScatter: number;
  readonly skyAffect: number;
  readonly aerialPerspective: number;
}
