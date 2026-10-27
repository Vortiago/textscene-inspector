/**
 * The rows a CylinderMesh, TubeTrailMesh or RibbonTrailMesh writes from the top edge down, as
 * `create_mesh_array` steps through them, and the quads between the rings of a round one.
 */

import { storedReal } from '../../../godot/math/real.js';
import type { SurfaceWriter } from './surfaceWriter.js';

/** A row's V down the mesh, and its Y on a mesh of the given height centred on the origin. */
export interface Row {
  v: number;
  y: number;
}

/**
 * Row `j` of `rowCount + 1` (`primitive_meshes.cpp:1115-1123`, `:2538-2543`, `:2910-2915`). Godot
 * holds V and Y in a `float`, so each rounds to single precision.
 *
 * @oneWay The rows and rings of a round primitive mesh
 *   Write the quads between them with `SurfaceWriter.quadBetweenRows`.
 */
export function rowAt(j: number, rowCount: number, height: number): Row {
  const v = storedReal(j / rowCount);
  return { v, y: storedReal(height * 0.5 - storedReal(height * v)) };
}

/**
 * Calls `writeRing` for each row `j` of the `rowCount + 1`, then joins the ring it wrote to the ring
 * above with `quadBetweenRows`. Every ring writes the same number of vertices.
 *
 * @oneWay The rows and rings of a round primitive mesh
 */
export function writeRings(writer: SurfaceWriter, rowCount: number, writeRing: (j: number) => void): void {
  let prevrow = writer.vertexCount;
  for (let j = 0; j <= rowCount; j++) {
    const thisrow = writer.vertexCount;
    writeRing(j);
    if (j > 0) {
      const columns = writer.vertexCount - thisrow;
      for (let i = 1; i < columns; i++) writer.quadBetweenRows(prevrow, thisrow, i);
    }
    prevrow = thisrow;
  }
}
