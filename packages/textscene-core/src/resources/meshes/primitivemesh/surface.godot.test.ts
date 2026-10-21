/**
 * Each round PrimitiveMesh against Godot 4.6.3: `surface.godot.json` holds the positions, UVs and
 * UV2s `get_mesh_arrays` returns for the same properties. The normals and tangents are left out,
 * as Godot hands them back through its 16-bit octahedral encoding (`rendering_server.cpp:616`).
 */

import { describe, expect, it } from 'vitest';
import measured from './surface.godot.json';
import { primitiveMeshSurface } from './surface';

/** One mesh as the JSON holds it: its `type=`, its properties as `.tscn` text, and Godot's arrays. */
interface MeasuredSurface {
  type: string;
  data: Record<string, string>;
  positions: number[];
  uvs: number[];
  uv2s: number[];
}

// Through `unknown`: JSON typing gives each mesh the other meshes' keys as optional `undefined`.
describe.each(measured.surfaces as unknown as MeasuredSurface[])(
  '$type against Godot',
  ({ type, data, ...arrays }) => {
    it.each(['positions', 'uvs', 'uv2s'] as const)('writes the same single-precision %s', (array) => {
      const surface = primitiveMeshSurface({ id: type, type, data }, measured.texel_size)!;

      // `+ 0` turns -0 into 0: the JSON keeps no sign on a zero.
      expect(Array.from(surface[array]!, (value) => value + 0)).toEqual(arrays[array]);
    });
  }
);
