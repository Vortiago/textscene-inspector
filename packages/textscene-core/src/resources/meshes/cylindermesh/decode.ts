/**
 * CylinderMesh decode — property bag in, radii/height/segment counts out.
 *
 * Defaults from Godot `primitive_meshes.h:199-205`. `set_radial_segments`
 * (`primitive_meshes.cpp:1347`) floors at 4; `set_rings` (:1360) ERR_FAILs below
 * 0, so a negative count keeps the default. The radii and height have no guard
 * (:1300-1339), which is what makes a cone (`top_radius = 0`) legal.
 */

import { floatOr } from '../../../parser/valueParsers';
import { countAtLeast, flooredCount } from '../meshCounts';
import type { CylinderMeshProperties } from './types';

export function decodeCylinderMesh(properties: Record<string, string>): CylinderMeshProperties {
  return {
    top_radius: floatOr(properties.top_radius, 0.5, 'CylinderMesh top_radius'),
    bottom_radius: floatOr(properties.bottom_radius, 0.5, 'CylinderMesh bottom_radius'),
    height: floatOr(properties.height, 2.0, 'CylinderMesh height'),
    radial_segments: flooredCount(
      properties.radial_segments,
      4,
      64,
      'CylinderMesh radial_segments'
    ),
    rings: countAtLeast(properties.rings, 0, 4, 'CylinderMesh rings'),
    capTop: properties.cap_top !== 'false',
    capBottom: properties.cap_bottom !== 'false',
  };
}
