import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { intValue, numberOf, realValue } from './valueOf.js';

/** Each `LightmapScale`'s texel scale (`visual_instance_3d.cpp:438-456`). */
const TEXEL_SCALES = [1, 2, 4, 8] as const;

/** GeometryInstance3D's deprecated `gi_lightmap_scale`, over the stored `gi_lightmap_texel_scale`. */
export class LightmapScaleProperties implements DerivedProperties {
  storedWritten(): void {}

  /** The closest step, as `get_lightmap_scale` rounds it (`visual_instance_3d.cpp:458-469`). */
  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'gi_lightmap_scale') return undefined;
    const texelScale = numberOf(stored('gi_lightmap_texel_scale'));
    if (texelScale < 1.5) return intValue(0);
    if (texelScale < 3) return intValue(1);
    return intValue(texelScale < 6 ? 2 : 3);
  }

  /** A step outside the enum fails `ERR_FAIL_INDEX` and leaves the scale as it was. */
  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    if (property !== 'gi_lightmap_scale') return undefined;
    const texelScale = TEXEL_SCALES[numberOf(value)];
    return texelScale === undefined ? [] : [['gi_lightmap_texel_scale', realValue(texelScale)]];
  }
}
