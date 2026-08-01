/**
 * TorusMesh decode — property bag in, radii and ring counts out.
 *
 * Defaults from Godot `primitive_meshes.h:377-380`. `set_rings`
 * (`primitive_meshes.cpp:2348`) and `set_ring_segments` (:2361) both ERR_FAIL
 * below 3, keeping the default. The radii have no setter guard (:2320, :2332);
 * their inner > outer swap and the equal-radii refusal happen when Godot builds
 * the surface (:2232-2241), so they live in `build.ts`.
 */

import { floatOr } from '../../../parser/valueParsers';
import { countAtLeast } from '../meshCounts';
import type { TorusMeshProperties } from './types';

export function decodeTorusMesh(properties: Record<string, string>): TorusMeshProperties {
  return {
    innerRadius: floatOr(properties.inner_radius, 0.5, 'TorusMesh innerRadius'),
    outerRadius: floatOr(properties.outer_radius, 1.0, 'TorusMesh outerRadius'),
    rings: countAtLeast(properties.rings, 3, 64, 'TorusMesh rings'),
    ringSegments: countAtLeast(properties.ring_segments, 3, 32, 'TorusMesh ringSegments'),
  };
}
