import * as THREE from 'three';
import type { DirectionalLight } from '../../shaders/spatial/directionalLights.js';
import { LIGHT_3D_DEFAULTS, DIRECTIONAL_LIGHT_3D_DEFAULTS } from '../../godot/scene/light.js';
import { godotEnergyOfIntensity } from '../../nodes/3d/lights/shared/lightStrength.js';
import { TrackedObjects } from '../trackedObjects.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { visibleInTree } from '../visibleInTree.js';
import { perObject } from '../../utils/perObject.js';
import { isDirectionalLight } from '../directionalShadow/lightLists.js';
import { shineDirection } from '../fog/fogLights.js';
import { readFogLightDeclaration } from '../fog/fogLightDeclaration.js';
import { readLightSpecularDeclaration } from '../lightSpecular/lightSpecular.js';
import { readLightSizeDeclaration } from '../lightSize/lightSize.js';
import { readLightBakeModeDeclaration } from '../lightBakeMode/lightBakeMode.js';

/** The light buffer's values that no other declaration of the light carries. */
interface SurfaceLightDeclaration {
  readonly cullMask: number;
  /** False for a Sky Only light, which the light buffer skips (`light_storage.cpp:631`). */
  readonly lightsSurfaces: boolean;
}

const declaration = userDataDeclaration<SurfaceLightDeclaration>(
  'surfaceLight',
  ({ cullMask, lightsSurfaces }) => typeof cullMask === 'number' && typeof lightsSurfaces === 'boolean'
);

/** The `userData` entry that declares a light's cull mask and Sky Only, to merge into its `userData`. */
export const surfaceLightUserData = declaration.userData;

/** A light that declares none, such as a GLB light, holds Godot's defaults of a DirectionalLight3D. */
const UNDECLARED: SurfaceLightDeclaration = { cullMask: LIGHT_3D_DEFAULTS.cullMask, lightsSurfaces: true };

/** Each scene's directional lights, in no particular order: a lit draw sums them. */
const trackedLightsOf = perObject((scene: THREE.Scene) => new TrackedObjects(scene, isDirectionalLight));

/** The three intensity holds the render's exposure, as Godot's energy does (`light_storage.cpp:656-658`). */
function directionalLightOf(light: THREE.DirectionalLight, cullMask: number): DirectionalLight {
  return {
    direction: shineDirection(light, new THREE.Vector3()).normalize().negate(),
    energy: godotEnergyOfIntensity(light.intensity),
    color: light.color.clone(),
    specular: readLightSpecularDeclaration(light)?.amount ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.specular,
    size: readLightSizeDeclaration(light)?.size ?? 0,
    cullMask,
    bakeMode: readLightBakeModeDeclaration(light)?.bakeMode ?? LIGHT_3D_DEFAULTS.bakeMode,
    volumetricFogEnergy: readFogLightDeclaration(light)?.energy ?? LIGHT_3D_DEFAULTS.volumetricFogEnergy,
  };
}

/** Each scene's lights of the last render that read them. Written only by `sceneDirectionalLights`. */
const lastLightsOf = perObject((_scene: THREE.Scene) => ({
  renderId: NaN,
  lights: [] as DirectionalLight[],
}));

/** The directional lights of `scene` that light surfaces in the render `renderId`, read once a render. */
export function sceneDirectionalLights(scene: THREE.Scene, renderId: number): readonly DirectionalLight[] {
  const last = lastLightsOf(scene);
  if (last.renderId === renderId) return last.lights;
  last.renderId = renderId;
  last.lights = trackedLightsOf(scene)
    .current()
    .flatMap((light) => {
      const own = declaration.read(light) ?? UNDECLARED;
      return own.lightsSurfaces && visibleInTree(light) ? [directionalLightOf(light, own.cullMask)] : [];
    });
  return last.lights;
}
