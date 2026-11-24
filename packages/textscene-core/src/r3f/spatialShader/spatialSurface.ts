import * as THREE from 'three';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal.js';
import { compileSpatial } from '../../shaders/spatial/compileSpatial.js';
import { isEmulatedPoints } from './pointSurface.js';
import { withGodotSurface } from './godotSurfaceWrite.js';
import {
  beforeEachDraw,
  specialiseSpatial,
  writeSpatialBindings,
  type SpatialScene,
} from '../../shaders/spatial/spatialBindings.js';
import type { SpatialOptions, TranspiledSpatial } from '../../shaders/spatial/transpileSpatial.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { ShaderText } from '../../resources/materials/shadermaterial/types.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import { renderTargetSize } from '../renderTargetSize.js';
import { renderedEnvironmentFog } from '../fog/fogFrame.js';

export { setMaterialParameters } from '../../shaders/uniforms/materialParameters.js';
export { drawPoints } from './pointSurface.js';
export { withGodotSurface } from './godotSurfaceWrite.js';

/** A spatial shader transpiled for one surface, or why the surface draws Godot's default one instead. */
export type SpatialSurface =
  | { readonly spatial: TranspiledSpatial; readonly samplers: Readonly<Record<string, ShaderSampler>> }
  | { readonly refusal: string };

/** The material of `shader` for a surface `gl` draws, which writes the scene of each draw's camera. */
export function spatialSurfaceOf(
  gl: THREE.WebGLRenderer,
  shader: ShaderText,
  options: SpatialOptions
): SpatialSurface {
  const compile = compileSpatial(shader.code, { ...options, file: shader.file });
  if (!('spatial' in compile))
    return { refusal: `[material] ${unDrawnMessage(compile, 'spatial', '3D surface')}` };
  const { spatial } = compile;
  const specialise = () => specialiseSpatial(spatial, renderedEnvironmentFog());
  spatial.material.onBeforeProgram = specialise;
  try {
    beforeEachDraw(spatial, (camera, object, material) => {
      prepareDrawnSurface(object);
      writeSpatialBindings(spatial, sceneOf(gl, camera));
      // A shadow or depth draw runs before the frame's fog, and folds none: only the colour draw picks it.
      if (material === spatial.material) specialise();
    });
  } catch (failure) {
    disposeSpatial(spatial);
    return { refusal: `[material] ${unDrawnMessage({ failure }, 'spatial', '3D surface')}` };
  }
  for (const error of spatial.printedErrors) warnOnce(shader, error, `[material] ${error}`);
  spatial.material.onTranslatorFault = (fault) =>
    warnOnce(
      shader,
      'translator fault',
      `[material] The previewer failed to draw this spatial shader: ${fault.message}`
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

/** Scratch for the clear colour and target size of one draw, overwritten by the next. */
const clearColor = new THREE.Color();
const targetSize = new THREE.Vector2();

/** What the colour pass reads from the frame `gl` draws through `camera`. */
function sceneOf(gl: THREE.WebGLRenderer, camera: THREE.Camera): SpatialScene {
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  return {
    camera: camera as SpatialScene['camera'],
    width,
    height,
    time: canvasShaderTime(gl).time,
    clearColor: gl.getClearColor(clearColor),
    fog: renderedEnvironmentFog(),
  };
}
