/**
 * TorusMesh decode. Defaults: `primitive_meshes.h:377-380`. `set_rings`
 * (`primitive_meshes.cpp:2348`) and `set_ring_segments` (:2361) ERR_FAIL below 3,
 * keeping the default. The radii have no setter guard (:2320, :2332): Godot swaps
 * or refuses them at surface build (:2232-2241), so that lives in `build.ts`.
 */

import { floatOr, settableIntOr } from '../../../parser/valueParsers';
import type { TorusMeshProperties } from './types';

export function decodeTorusMesh(properties: Record<string, string>): TorusMeshProperties {
  return {
    innerRadius: floatOr(properties.inner_radius, 0.5, 'TorusMesh innerRadius'),
    outerRadius: floatOr(properties.outer_radius, 1.0, 'TorusMesh outerRadius'),
    rings: settableIntOr(properties.rings, 64, { min: 3 }, 'TorusMesh rings'),
    ringSegments: settableIntOr(
      properties.ring_segments,
      32,
      { min: 3 },
      'TorusMesh ringSegments'
    ),
  };
}
