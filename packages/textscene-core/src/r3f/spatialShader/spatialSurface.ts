import * as THREE from 'three';
import {
  generatedUnDrawnMessage,
  spatialShaderName,
  unDrawnMessage,
  type ShaderUnDrawn,
} from '../../shaders/fault/shaderRefusal.js';
import { compileSpatial } from '../../shaders/spatial/compileSpatial.js';
import { isEmulatedPoints } from './pointSurface.js';
import { withGodotSurface } from './godotSurfaceWrite.js';
import {
  beforeEachDraw,
  specialiseSpatial,
  writeSpatialBindings,
  type SpatialDraw,
  type SpatialScene,
} from '../../shaders/spatial/spatialBindings.js';
import type { SpatialOptions, TranspiledSpatial } from '../../shaders/spatial/transpileSpatial.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { SurfaceShader } from './surfaceShader.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import { renderTargetSize } from '../renderTargetSize.js';
import { renderedEnvironmentFog } from '../fog/fogFrame.js';
import { sceneSuns } from '../surfaceLight/surfaceLight.js';
import {
  directionalShadowAtlasColour,
  directionalShadowAtlasDepth,
} from '../directionalShadow/shadowAtlas.js';
import { hasDirectionalSoftShadowAngle } from '../../shaders/spatial/directionalLights.js';
import { sceneAmbientLight } from '../surfaceLight/sceneAmbientLight.js';
import { sceneSkyLight, unmixedAmbientLight } from '../surfaceLight/sceneSkyLight.js';
import { EMISSION_EXPOSURE } from '../exposure/emissionExposure.js';
import { visualLayersOf } from '../visualLayers.js';
import { releasedOnUnmount } from '../sharedTexture.js';
import { dfgTexture } from '../../shaders/spatial/dfgTexture.js';
import { unboundDirectionalShadowColour } from '../../shaders/spatial/directionalShadowDepth.js';
import { recordCastsShadow } from '../materials/recordedOnMaterial.js';
import type { RoughnessLimiter } from '../../godot/rendering/roughnessLimiter.js';

export { setParameterValues } from '../../shaders/uniforms/materialParameters.js';
export { surfaceShaderOf } from './surfaceShader.js';
export { drawPoints } from './pointSurface.js';
export { withGodotSurface } from './godotSurfaceWrite.js';

/** A spatial shader transpiled for one surface, or why the surface draws Godot's default one instead. */
export type SpatialSurface =
  | { readonly spatial: TranspiledSpatial; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: string };

/** The options of a transpile, and the project settings each draw's scene reads. */
export interface SurfaceOptions extends SpatialOptions {
  readonly roughnessLimiter: RoughnessLimiter;
}

/** The material of `shader` for a surface `gl` draws, which writes the scene of each draw's camera. */
export function spatialSurfaceOf(
  gl: THREE.WebGLRenderer,
  shader: SurfaceShader,
  { roughnessLimiter, ...options }: SurfaceOptions
): SpatialSurface {
  const compile = compileSpatial(shader.code, {
    ...options,
    file: shader.file,
    instanceLayers: visualLayersOf,
  });
  if (!('spatial' in compile)) return { refusal: refusalOf(shader, compile) };
  const { spatial } = compile;
  recordCastsShadow(spatial.material, spatial.castsShadow);
  releasedOnUnmount(dfgTexture());
  releasedOnUnmount(unboundDirectionalShadowColour());
  // Written by each colour draw, so a program built between draws keeps the last one's soft shadows.
  let drawsSoftShadows = false;
  const specialise = () =>
    specialiseSpatial(spatial, {
      fog: renderedEnvironmentFog(),
      drawsDirectionalSoftShadows: drawsSoftShadows,
    });
  spatial.material.onBeforeProgram = specialise;
  try {
    beforeEachDraw(spatial, (drawn) => {
      prepareDrawnSurface(drawn.object);
      const scene = sceneOf(gl, drawn, roughnessLimiter);
      writeSpatialBindings(spatial, scene);
      // A shadow or depth draw runs before the frame's fog, and folds none: only the colour draw picks it.
      if (drawn.material !== spatial.material) return;
      drawsSoftShadows = hasDirectionalSoftShadowAngle(scene.directionalLights);
      specialise();
    });
  } catch (failure) {
    disposeSpatial(spatial);
    return { refusal: refusalOf(shader, { failure }) };
  }
  for (const error of spatial.printedErrors) warnOnce(shader, error, `[material] ${error}`);
  spatial.material.onTranslatorFault = (fault) =>
    warnOnce(
      shader,
      'translator fault',
      `[material] The previewer failed to draw ${spatialShaderName(shader.generatedFor)}: ${fault.message}`
    );
  return compile;
}

/** The attributes of the surface `object` draws. Emulated points refresh before the render list. */
function prepareDrawnSurface(object: THREE.Object3D): void {
  if (isEmulatedPoints(object)) return;
  const geometry = (object as Partial<THREE.Mesh>).geometry;
  if (geometry) withGodotSurface(geometry);
}

export function disposeSpatial({ material, buffers }: TranspiledSpatial): void {
  material.dispose();
  for (const rows of buffers.values()) rows.texture.dispose();
}

/** Scratch for the clear colour, ambient light and target size of one draw, overwritten by the next. */
const clearColor = new THREE.Color();
const ambientLight = new THREE.Color();
const targetSize = new THREE.Vector2();

/** What the colour pass reads from the frame `gl` draws for `drawn`. */
function sceneOf(
  gl: THREE.WebGLRenderer,
  { camera, scene, renderId }: SpatialDraw,
  roughnessLimiter: RoughnessLimiter
): SpatialScene {
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  const sky = sceneSkyLight();
  const sceneAmbient = sceneAmbientLight(scene, gl.getClearColor(clearColor), renderId);
  const directionalLights = sceneSuns(scene);
  return {
    camera: camera as SpatialScene['camera'],
    width,
    height,
    time: canvasShaderTime(gl).time,
    ambientLight: unmixedAmbientLight(sceneAmbient, sky, ambientLight),
    ...(sky && { sky }),
    emissiveExposure: EMISSION_EXPOSURE[0]!,
    fog: renderedEnvironmentFog(),
    directionalLights,
    // The atlas holds GPU memory only while a shadow draws into it.
    ...(directionalLights.some(({ shadow }) => shadow) && {
      directionalShadowAtlas: {
        depth: directionalShadowAtlasDepth(),
        colour: directionalShadowAtlasColour(),
      },
    }),
    roughnessLimiter,
  };
}

/** The warning for a surface that draws its fallback, named for the kind of its source. */
function refusalOf({ generatedFor }: SurfaceShader, compile: ShaderUnDrawn): string {
  const message = generatedFor
    ? generatedUnDrawnMessage(compile, generatedFor)
    : unDrawnMessage(compile, 'spatial', '3D surface');
  return `[material] ${message}`;
}
