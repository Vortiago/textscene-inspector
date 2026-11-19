import * as THREE from 'three';
import type { EnvironmentFog } from '../../shaders/pipeline/environmentFog.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import type { FogMode } from '../../godot/rendering/environment/depthFog.js';
import { fogUniforms } from './fogUniforms.js';

/** Scratch for one draw's fog, overwritten by the next: each surface reads it before every draw. */
const renderedFog = {
  lightColor: new THREE.Color(),
  lightEnergy: 1,
  mode: 0 as EnumValue<typeof FogMode>,
  density: 0,
  height: 0,
  heightDensity: 0,
  depthCurve: 1,
  depthBegin: 0,
  depthEnd: 0,
  sunScatter: 0,
  skyAffect: 0,
  aerialPerspective: 0,
};

/** The depth fog `prepareFog` wrote for this render, or nothing when off: the colour holds the energy. */
export function renderedEnvironmentFog(): EnvironmentFog | undefined {
  const { depthColor, depthShape, depthLayer, depthSky } = fogUniforms;
  if (depthColor[3] === 0) return undefined;
  renderedFog.lightColor.setRGB(depthColor[0]!, depthColor[1]!, depthColor[2]!);
  renderedFog.density = depthShape[0]!;
  renderedFog.depthBegin = depthShape[1]!;
  renderedFog.depthEnd = depthShape[2]!;
  renderedFog.depthCurve = depthShape[3]!;
  renderedFog.mode = depthLayer[0] as EnumValue<typeof FogMode>;
  renderedFog.height = depthLayer[1]!;
  renderedFog.heightDensity = depthLayer[2]!;
  renderedFog.aerialPerspective = depthLayer[3]!;
  renderedFog.skyAffect = depthSky[0]!;
  renderedFog.sunScatter = depthSky[1]!;
  return renderedFog;
}
