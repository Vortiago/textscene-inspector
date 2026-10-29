/** A triplanar record a test compiles: a world UV1 projection on every map that reads UV1. */

import type { TriplanarRecord } from '../materials/godotTriplanar';

/** A world UV1 projection at scale 2, offset 0.25 and sharpness 4, with `overrides` on top. */
export function worldTriplanarRecord(overrides: Partial<TriplanarRecord> = {}): TriplanarRecord {
  return {
    uv1: { scale: { x: 2, y: 2, z: 2 }, offset: { x: 0.25, y: 0.25, z: 0.25 }, sharpness: 4, isWorld: true },
    uv2: null,
    isTangentWorld: true,
    isBillboard: false,
    uv1Maps: ['map', 'normalMap', 'roughnessMap'],
    uv2Maps: [],
    ...overrides,
  };
}
