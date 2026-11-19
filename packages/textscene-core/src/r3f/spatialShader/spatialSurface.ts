import * as THREE from 'three';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal.js';
import { compileSpatial } from '../../shaders/spatial/compileSpatial.js';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes.js';
import {
  beforeEachDraw,
  specialiseSpatial,
  writeSpatialBindings,
  type SpatialScene,
} from '../../shaders/spatial/spatialBindings.js';
import type { SpatialOptions, TranspiledSpatial } from '../../shaders/spatial/transpileSpatial.js';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers.js';
import type { ShaderText } from '../../resources/materials/shadermaterial/types.js';
import { perObject } from '../../utils/perObject.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime.js';
import { renderTargetSize } from '../renderTargetSize.js';
import { renderedEnvironmentFog } from '../fog/fogFrame.js';

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
  const specialise = () => specialiseSpatial(spatial, renderedEnvironmentFog());
  spatial.material.onBeforeProgram = specialise;
  try {
    beforeEachDraw(spatial, (camera, object, material) => {
      if (object instanceof THREE.Mesh) withGodotSurface(object.geometry);
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

/** Godot's attributes, written again when one the previewer holds changes, as a sprite's frame does. */
export function withGodotSurface(geometry: THREE.BufferGeometry): void {
  if (!hasSourcesChanged(geometry)) return;
  withGodotAttributes(geometry);
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv_attrib', fromTopRow(uv));
}

/** The previewer's attributes that Godot's are built from, as `withGodotAttributes` reads them. */
const SOURCE_ATTRIBUTES = [
  'position',
  'normal',
  'tangent',
  'color',
  'uv',
  'uv1',
  'custom0',
  'custom1',
  'custom2',
  'custom3',
  'skinIndex',
  'skinWeight',
];

/** Each geometry's index, source attributes and their versions at its last write, by `hasSourcesChanged`. */
// eslint-disable-next-line no-restricted-syntax -- a record of the last write, compared on each draw, not a built value
const writtenSources = new WeakMap<THREE.BufferGeometry, unknown[]>();

/** Whether the index or a source attribute is new or changed since the last write, which it records. */
function hasSourcesChanged(geometry: THREE.BufferGeometry): boolean {
  const written = writtenSources.get(geometry);
  if (written && isWrittenStamp(geometry, written)) return false;
  writtenSources.set(geometry, sourceStamp(geometry));
  return true;
}

/** Compared in place, with no array per draw: it runs before every draw of the surface. */
function isWrittenStamp(geometry: THREE.BufferGeometry, written: readonly unknown[]): boolean {
  for (let i = 0; i <= SOURCE_ATTRIBUTES.length; i++) {
    const source = sourceAt(geometry, i);
    if (written[i * 2] !== source || written[i * 2 + 1] !== (source ? versionOf(source) : -1)) return false;
  }
  return true;
}

function sourceStamp(geometry: THREE.BufferGeometry): unknown[] {
  const stamp: unknown[] = [];
  for (let i = 0; i <= SOURCE_ATTRIBUTES.length; i++) {
    const source = sourceAt(geometry, i);
    stamp.push(source, source ? versionOf(source) : -1);
  }
  return stamp;
}

function sourceAt(geometry: THREE.BufferGeometry, i: number) {
  return i === 0 ? geometry.index : geometry.getAttribute(SOURCE_ATTRIBUTES[i - 1]!);
}

function versionOf(source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number {
  return source instanceof THREE.InterleavedBufferAttribute ? source.data.version : source.version;
}

type UvAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** Each first UV set flipped once while it is unchanged: every pass of a surface attaches it again. */
const fromTopRow = perObject(flippedCopy, { stamp: versionOf });

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
    fog: renderedEnvironmentFog(),
  };
}
