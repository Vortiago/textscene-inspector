import { MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import type { MaterialKey } from './materialKey.js';

/** A texture read on UV1 or UV2: Godot's triplanar function when that UV is triplanar. */
export function readOn(key: MaterialKey, uv: 1 | 2, sampler: string): string {
  if (key.flags.has(uv === 1 ? MaterialFlag.UV1_USE_TRIPLANAR : MaterialFlag.UV2_USE_TRIPLANAR))
    return `triplanar_texture(${sampler}, uv${uv}_power_normal, uv${uv}_triplanar_pos)`;
  return `texture(${sampler}, ${uv === 1 ? 'base_uv' : 'base_uv2'})`;
}

/** A texture read on UV1, the layer every texture but detail, emission and occlusion reads. */
export const read = (key: MaterialKey, sampler: string): string => readOn(key, 1, sampler);
