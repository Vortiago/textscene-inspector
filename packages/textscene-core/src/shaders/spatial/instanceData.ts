import type * as THREE from 'three';

/** `InstanceData` (`render_forward_clustered.h:328-338`), in the std430 layout the template reads. */
const INSTANCE_WORDS = 44;

/** `INSTANCE_FLAGS_NON_UNIFORM_SCALE` (`scene_forward_clustered_inc.glsl:175`). */
const NON_UNIFORM_SCALE = 1 << 4;

/** `INSTANCE_FLAGS_FADE_SHIFT`: the fade alpha's byte, 255 for an object that does not fade. */
const FADE_SHIFT = 24;

/** `RenderGeometryInstanceBase::layer_mask`'s default, the first visual layer. */
const FIRST_LAYER = 1;

/** No instance uniforms: `shader_uniforms_offset` of -1, as a uint. */
const NO_INSTANCE_UNIFORMS = 0xffffffff;

/** An instance of an uncompressed surface, unfaded and unlightmapped (`render_forward_clustered.cpp:820`). */
export function instanceWords(world: THREE.Matrix4): Uint32Array {
  const words = new Uint32Array(INSTANCE_WORDS);
  const floats = new Float32Array(words.buffer);
  const transform = transposed3x4(world);
  floats.set(transform, 0);
  // The surface's AABB of an uncompressed surface: position 0, size 1, and a uv scale of 0.
  floats.set([1, 1, 1, 0], 16);
  words[24] = instanceFlags(world);
  words[25] = NO_INSTANCE_UNIFORMS;
  words[27] = FIRST_LAYER;
  floats.set(transform, 28);
  return words;
}

/** `store_transform_transposed_3x4` (`material_storage.h`): the first three rows, one after another. */
export function transposed3x4(matrix: THREE.Matrix4): number[] {
  const e = matrix.elements;
  return [0, 1, 2].flatMap((row) => [e[row]!, e[4 + row]!, e[8 + row]!, e[12 + row]!]);
}

/** The fade byte, and the non-uniform scale bit (`renderer_geometry_instance.cpp:72-78`). */
function instanceFlags(world: THREE.Matrix4): number {
  const e = world.elements;
  const scales = [0, 4, 8].map((column) =>
    Math.fround(Math.hypot(e[column]!, e[column + 1]!, e[column + 2]!))
  );
  const most = Math.max(...scales);
  const least = Math.min(...scales);
  const isNonUniform = most >= 0 && Math.fround(least / most) < 0.9;
  return ((255 << FADE_SHIFT) | (isNonUniform ? NON_UNIFORM_SCALE : 0)) >>> 0;
}
