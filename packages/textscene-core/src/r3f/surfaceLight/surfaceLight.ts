import * as THREE from 'three';
import type { DirectionalLight, DirectionalShadow } from '../../shaders/spatial/directionalLights.js';
import { blendsSplits, MAX_DIRECTIONAL_LIGHTS } from '../../godot/rendering/lights/directionalShadow.js';
import { readDirectionalShadowDeclaration } from '../directionalShadow/declaration.js';
import { splitSunOf } from '../directionalShadow/splitSun.js';
import { NO_SHADOW_FADE } from '../directionalShadow/splitShadow.js';
import { LIGHT_3D_DEFAULTS, DIRECTIONAL_LIGHT_3D_DEFAULTS } from '../../godot/scene/light.js';
import { godotEnergyOfIntensity } from '../../nodes/3d/lights/shared/lightStrength.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { perObject } from '../../utils/perObject.js';
import { isDirectionalLight, type SceneLight } from '../directionalShadow/lightLists.js';
import { isDropped } from '../directionalShadow/droppedLight.js';
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

/** The three intensity holds the render's exposure, as Godot's energy does (`light_storage.cpp:656-658`). */
function directionalLightOf(light: THREE.DirectionalLight, cullMask: number): DirectionalLight {
  const shadow = shadowOf(light);
  return {
    ...(shadow && { shadow }),
    direction: shineDirection(light, new THREE.Vector3()).normalize().negate(),
    // Read at the draw: the render's exposure scales the intensity after the light pass publishes.
    get energy() {
      return godotEnergyOfIntensity(light.intensity);
    },
    color: light.color.clone(),
    specular: readLightSpecularDeclaration(light)?.amount ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.specular,
    size: readLightSizeDeclaration(light)?.size ?? 0,
    cullMask,
    bakeMode: readLightBakeModeDeclaration(light)?.bakeMode ?? LIGHT_3D_DEFAULTS.bakeMode,
    volumetricFogEnergy: readFogLightDeclaration(light)?.energy ?? LIGHT_3D_DEFAULTS.volumetricFogEnergy,
  };
}

/** Ends past any view depth, as Godot's smoothstep needs ends that differ (`light_storage.cpp:753`). */
const FADES_NOTHING = { from: 0.999e30, to: 1e30 };

/** The split sun's own slots and matrices, so a draw reads what its render's shadow pass wrote. */
function shadowOf(light: THREE.DirectionalLight): DirectionalShadow | null {
  const sun = splitSunOf(light);
  const declaration = readDirectionalShadowDeclaration(light);
  if (!sun || !declaration) return null;
  const { shadow } = sun;
  const slots = shadow._cascadeData;
  const zRanges = shadow.zRanges.toArray();
  return {
    opacity: shadow.intensity,
    softShadowScale: declaration.filterRadius,
    softShadowAngle: shadow.softShadowAngle,
    blendSplits: blendsSplits(declaration.splitCount, declaration.blendSplits),
    fade: shadow.fade === NO_SHADOW_FADE ? FADES_NOTHING : shadow.fade,
    splitEnds: slots.map((slot) => slot.x),
    depthBiases: shadow.depthBiases.toArray(),
    normalBiases: slots.map((slot) => slot.z),
    transmittanceBiases: zRanges.map((zRange) => zRange * declaration.transmittanceBias),
    rangeBegins: shadow.godotRangeBegins.toArray(),
    zRanges,
    atlasShare: {
      rect: shadow.atlasRect,
      splitCount: shadow.splitCount,
      depthScales: shadow.depthScales.toArray(),
    },
    splitMatrix: (split) => shadow.getMatrix(split),
  };
}

/** A light whose row the draw builds, with the cull mask its own declaration gives. */
interface PublishedSun {
  readonly light: THREE.DirectionalLight;
  readonly cullMask: number;
}

/** Each scene's suns of its last light pass. Written by `publishSceneSuns`, cleared by `releaseSceneSuns`. */
const publishedSunsOf = perObject((_scene: THREE.Scene) => ({
  lights: [] as readonly PublishedSun[],
  /** Built at the first `sceneSuns` of the render, so a scene with no lit translated draw builds none. */
  suns: null as readonly DirectionalLight[] | null,
}));

/** A light the fitter dropped past Godot's eighth lights no surface either. */
export function publishSceneSuns(scene: THREE.Scene, lights: readonly SceneLight[]): void {
  const published: PublishedSun[] = [];
  for (const { light, isVisible } of lights) {
    if (published.length === MAX_DIRECTIONAL_LIGHTS) break;
    if (!isDirectionalLight(light) || !isVisible || isDropped(light)) continue;
    const own = declaration.read(light) ?? UNDECLARED;
    if (own.lightsSurfaces) published.push({ light, cullMask: own.cullMask });
  }
  Object.assign(publishedSunsOf(scene), { lights: published, suns: null });
}

/** The suns the light pass published for the render of `scene` under way, none before its first. */
export function sceneSuns(scene: THREE.Scene): readonly DirectionalLight[] {
  const published = publishedSunsOf(scene);
  published.suns ??= published.lights.map(({ light, cullMask }) => directionalLightOf(light, cullMask));
  return published.suns;
}

/** Clears the suns of `scene` when its light pass stops, as they hold the released split suns' shadows. */
export function releaseSceneSuns(scene: THREE.Scene): void {
  Object.assign(publishedSunsOf(scene), { lights: [], suns: null });
}
