import * as THREE from 'three';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal.js';
import { compileSpatial } from '../../shaders/spatial/compileSpatial.js';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes.js';
import { writeSpatialBindingsEachDraw, type SpatialScene } from '../../shaders/spatial/spatialBindings.js';
import type { SpatialOptions, TranspiledSpatial } from '../../shaders/spatial/transpileSpatial.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { ShaderText } from '../../resources/materials/shadermaterial/types.js';
import { perObject } from '../../utils/perObject.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import { renderTargetSize } from '../renderTargetSize.js';

export { setMaterialParameters } from '../../shaders/uniforms/materialParameters.js';

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
  writeSpatialBindingsEachDraw(spatial, (camera) => sceneOf(gl, camera));
  spatial.material.onTranslatorFault = (fault) =>
    warnOnce(
      shader,
      'translator fault',
      `[material] The previewer failed to draw this spatial shader: ${fault.message}`
    );
  return compile;
}

/** Godot's attributes. The previewer holds the first UV set from the bottom row, Godot from the top row. */
export function withGodotSurface(geometry: THREE.BufferGeometry): void {
  withGodotAttributes(geometry);
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv_attrib', fromTopRow(uv));
}

type UvAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** Each first UV set flipped once while it is unchanged: every pass of a surface attaches it again. */
const fromTopRow = perObject(flippedCopy, {
  stamp: (uv: UvAttribute) => (uv instanceof THREE.InterleavedBufferAttribute ? uv.data.version : uv.version),
});

function flippedCopy(uv: UvAttribute): THREE.BufferAttribute {
  const flipped = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    flipped[i * 2] = uv.getX(i);
    flipped[i * 2 + 1] = 1 - uv.getY(i);
  }
  return new THREE.BufferAttribute(flipped, 2);
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
  };
}
