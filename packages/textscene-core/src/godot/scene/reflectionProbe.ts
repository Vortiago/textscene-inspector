/** Godot 4.6.3's ReflectionProbe node: its class defaults and what its setters store. */

import { sign } from '../math/math.js';
import { storedReal, storedVector3 } from '../math/real.js';
import type { Vector3 } from '../math/vector.js';
import { ReflectionProbeAmbientMode } from '../rendering/environment/reflectionProbe.js';
import { GODOT_EDITOR_LAYERS_MASK } from './visualLayers.js';

/** `ReflectionProbe`'s defaults (`reflection_probe.h:52-67`). */
export const REFLECTION_PROBE_DEFAULTS = {
  intensity: 1,
  blendDistance: 1,
  maxDistance: 0,
  size: { x: 20, y: 20, z: 20 },
  originOffset: { x: 0, y: 0, z: 0 },
  ambientMode: ReflectionProbeAmbientMode.ENVIRONMENT,
  ambientColorEnergy: 1,
  layerMask: GODOT_EDITOR_LAYERS_MASK,
} as const;

/** `set_max_distance` clamps to this (`reflection_probe.cpp:81`). */
export const REFLECTION_PROBE_MAX_DISTANCE = 262_144;

/** The margin both setters keep between `origin_offset` and a face of the box. */
const FACE_MARGIN = 0.01;

/**
 * The `origin_offset` Godot holds after it applies a file's `size` and `origin_offset` lines in
 * order. Each setter clamps each axis to `half_size - 0.01`, and only `set_size` floors `half_size`
 * at 0.01 (`reflection_probe.cpp:99-136`). An offset listed before `size` meets the default size.
 */
export function loadedOriginOffset(lines: Iterable<readonly ['size' | 'origin_offset', Vector3]>): Vector3 {
  let size: Vector3 = REFLECTION_PROBE_DEFAULTS.size;
  let offset: Vector3 = REFLECTION_PROBE_DEFAULTS.originOffset;
  for (const [key, value] of lines) {
    const stored = storedVector3(value);
    if (key === 'size') size = stored;
    else offset = stored;
    offset = clampedOffset(offset, size, key === 'size');
  }
  return offset;
}

function clampedOffset(offset: Vector3, size: Vector3, floorsHalfSize: boolean): Vector3 {
  const clampAxis = (axis: keyof Vector3): number => {
    let halfSize = storedReal(size[axis] / 2);
    if (floorsHalfSize && halfSize < FACE_MARGIN) halfSize = storedReal(FACE_MARGIN);
    const limit = halfSize - FACE_MARGIN;
    const component = offset[axis];
    return limit < Math.abs(component) ? storedReal(sign(component) * limit) : component;
  };
  return { x: clampAxis('x'), y: clampAxis('y'), z: clampAxis('z') };
}
