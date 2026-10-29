/**
 * Which sky materials read the DirectionalLights. The procedural and the physical sky read `LIGHT0`
 * (`sky_material.cpp:326`, `:766`), and the panorama reads only its texture (`:502`).
 */

import type { SkyProperties } from './types';

export function materialReadsLights(material: SkyProperties): boolean {
  return material.kind !== 'panorama';
}
