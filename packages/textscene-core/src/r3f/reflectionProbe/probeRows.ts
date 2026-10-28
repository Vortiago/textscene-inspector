/**
 * The probes a scene draws with, packed as the texels each lit fragment fetches: Godot's
 * `ReflectionData` (`light_storage.cpp:1785-1824`), one row of `SCENE_ROW_TEXELS` per probe.
 */

import type * as THREE from 'three';
import type { ReflectionProbeAmbientMode } from '../../godot/rendering/environment/reflectionProbe.js';
import type { Vector3 } from '../../godot/math/vector.js';
import { sRGBToLinearRGB } from '../../utils/colorSpace.js';
import type { Rgba } from '../../godot/math/math.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { RowBuffer } from '../rowTexture/packedRows.js';
import { SCENE_ROW_TEXELS } from '../sceneRows/sceneRowsChunk.js';

/** What the shader reads of one probe. */
export interface DrawnProbe {
  /** The inverse of the probe's world transform, its scale dropped as Godot's probe disables it. */
  worldToLocal: THREE.Matrix4;
  size: Vector3;
  blendDistance: number;
  originOffset: Vector3;
  intensity: number;
  ambientMode: EnumValue<typeof ReflectionProbeAmbientMode>;
  ambientColor: Rgba;
  ambientColorEnergy: number;
  reflectionMask: number;
  boxProjection: boolean;
  atlasLayer: number;
  /**
   * What the capture and the ambient it gives scale by: the exposure the scene renders with over the
   * one the probe captured at, or 1 with no exposure (`light_storage.cpp:1810-1814`).
   */
  exposureNormalization: number;
}

/**
 * The rows of the drawn probes, rewritten in place by each `pack`. The texels of one probe: the
 * world-to-local matrix's rows, the half size and the blend distance, the origin offset and the
 * intensity, the ambient and its mode, then the mask, the box projection and the atlas layer, then
 * the exposure normalisation. The mask goes in two 16-bit halves, as a float holds 24 bits exactly.
 */
export class ProbeRows extends RowBuffer {
  /** The row being packed, as wide as a decal's, whose extra texels stay zero. */
  private readonly row = new Float32Array(SCENE_ROW_TEXELS * 4);

  constructor() {
    super(SCENE_ROW_TEXELS * 4);
  }

  /** Packs `probes` in order, and answers whether any row changed. */
  pack(probes: readonly DrawnProbe[]): boolean {
    this.begin();
    for (const probe of probes) {
      this.row.set(probeTexels(probe));
      this.append(this.row);
    }
    return this.finish();
  }
}

function probeTexels(probe: DrawnProbe): number[] {
  const m = probe.worldToLocal.elements;
  const matrixRow = (row: number) => [m[row]!, m[4 + row]!, m[8 + row]!, m[12 + row]!];
  const { size, originOffset, ambientColor: colour, ambientColorEnergy: energy, reflectionMask } = probe;
  // Godot stores the ambient colour in linear, times its energy (`light_storage.cpp:1817-1822`).
  const ambient = sRGBToLinearRGB(colour.r, colour.g, colour.b).map((channel) => channel * energy);
  const texels = [
    matrixRow(0),
    matrixRow(1),
    matrixRow(2),
    [size.x / 2, size.y / 2, size.z / 2, probe.blendDistance],
    [originOffset.x, originOffset.y, originOffset.z, probe.intensity],
    [...ambient, probe.ambientMode],
    [reflectionMask & 0xffff, reflectionMask >>> 16, probe.boxProjection ? 1 : 0, probe.atlasLayer],
    [probe.exposureNormalization, 0, 0, 0],
  ];
  return texels.flat();
}
