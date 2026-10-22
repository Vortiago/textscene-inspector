/**
 * Each round PrimitiveMesh against Godot 4.6.3: `surface.godot.json` holds the positions, UVs and
 * UV2s `get_mesh_arrays` returns for the same properties. The normals and tangents are left out,
 * as Godot hands them back through its 16-bit octahedral encoding (`rendering_server.cpp:616`).
 */

import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import measured from './surface.godot.json';
import { primitiveMeshSurface } from './surface';
import { scopedMesh } from './surface.testkit';

/**
 * One mesh as the JSON holds it: its `type=`, its properties as `.tscn` text, the sub-resources
 * they name (a TubeTrailMesh's Curve), and Godot's arrays.
 */
interface MeasuredSurface {
  type: string;
  data: Record<string, string>;
  sub_resources?: TscnInternalResource[];
  positions: number[];
  uvs: number[];
  uv2s: number[];
}

// Through `unknown`: JSON typing gives each mesh the other meshes' keys as optional `undefined`.
describe.each(measured.surfaces as unknown as MeasuredSurface[])(
  '$type against Godot',
  ({ type, data, sub_resources = [], ...arrays }) => {
    it.each(['positions', 'uvs', 'uv2s'] as const)('writes the same single-precision %s', (array) => {
      const mesh = scopedMesh({ id: type, type, data }, ...sub_resources);
      const surface = primitiveMeshSurface(mesh, measured.texel_size)!;

      // `+ 0` turns -0 into 0: the JSON keeps no sign on a zero.
      expect(Array.from(surface[array]!, (value) => value + 0)).toEqual(arrays[array]);
    });
  }
);
