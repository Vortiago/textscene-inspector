import * as THREE from 'three';
import { compileSpatial, type SpatialCompile } from '../../shaders/spatial/compileSpatial.js';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes.js';
import { writeSpatialBindingsEachDraw, type SpatialScene } from '../../shaders/spatial/spatialBindings.js';
import type { SpatialOptions, TranspiledSpatial } from '../../shaders/spatial/transpileSpatial.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { ShaderText } from '../../resources/materials/shadermaterial/types.js';
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
  if (!('spatial' in compile)) return { refusal: unDrawnMessage(compile) };
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

/**
 * `geometry` with Godot's attributes. A surface of the previewer holds its first UV set from the
 * bottom row, as three uploads a texture, and Godot's shader reads it from the top row.
 */
export function withGodotSurface(geometry: THREE.BufferGeometry): void {
  withGodotAttributes(geometry);
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv_attrib', fromTopRow(uv));
}

function fromTopRow(uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
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

/** Scratch for the clear colour of one draw, overwritten by the next. */
const clearColor = new THREE.Color();

/** What the colour pass reads from the frame `gl` draws through `camera`. */
function sceneOf(gl: THREE.WebGLRenderer, camera: THREE.Camera): SpatialScene {
  const { x: width, y: height } = renderTargetSize(gl, new THREE.Vector2());
  return {
    camera: camera as SpatialScene['camera'],
    width,
    height,
    time: canvasShaderTime(gl).time,
    clearColor: gl.getClearColor(clearColor),
  };
}

type UnDrawnSpatial = Exclude<SpatialCompile, { readonly spatial: unknown }>;

function unDrawnMessage(compile: UnDrawnSpatial): string {
  if ('failure' in compile)
    return `[material] The previewer failed to translate this spatial shader, and draws Godot's default 3D surface: ${String(compile.failure)}`;
  const { refusal } = compile;
  if (refusal.owner === undefined)
    return `[material] Godot does not compile the spatial shader, and draws its default 3D surface: ${refusal.message}`;
  return `[material] The previewer does not translate this spatial shader yet (${refusal.owner}), and draws Godot's default 3D surface: ${refusal.message}`;
}
