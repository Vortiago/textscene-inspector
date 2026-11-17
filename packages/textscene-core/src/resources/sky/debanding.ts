/**
 * Which skies Godot debands. ProceduralSkyMaterial and PhysicalSkyMaterial write
 * `render_mode use_debanding` from their `use_debanding` (`sky_material.cpp:377`, `:819`), and
 * PanoramaSkyMaterial writes no such mode.
 */

import type { SkyProperties } from './types';

export function isDebanded(material: SkyProperties): boolean {
  // A shader sky's own `use_debanding` runs inside the transpiled sky template.
  if (material.kind === 'panorama' || material.kind === 'shader') return false;
  return material.use_debanding;
}
