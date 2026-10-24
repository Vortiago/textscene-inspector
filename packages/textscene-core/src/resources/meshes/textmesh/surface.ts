/**
 * A TextMesh's surface as `PrimitiveMesh::_update` leaves it. TextMesh writes no UV2 and keeps
 * the authored `lightmap_size_hint`, as it overrides neither `_update_lightmap_size` nor
 * `_create_mesh_array`'s UV2.
 */

import type { TscnInternalResource } from '../../../parser/types';
import type { GodotSurface } from '../godotSurface';
import { authoredLightmapSizeHint, finishPrimitiveSurface } from '../primitivemesh/surface';
import { buildTextMeshSurface, type TextMeshFace } from './build';
import { decodeTextMesh } from './decode';

const LIGHTMAP_SIZE_HINT = authoredLightmapSizeHint('TextMesh');

/** A surface and what it was built from besides the resource's own properties. */
interface BuiltSurface extends TextMeshFace {
  texelSize: number;
  surface: GodotSurface;
}

/**
 * Written only by `textMeshSurface`: one entry per resource, replaced when its face or the texel
 * size changes. An entry goes when the parsed resource does, so the geometry and the box of one
 * mesh share one build.
 */
const builtSurfaces = new WeakMap<TscnInternalResource, BuiltSurface>();

/** The surface of `mesh` shaped in `face`. The surface is shared, so a caller copies before it writes. */
export function textMeshSurface(
  mesh: TscnInternalResource,
  face: TextMeshFace,
  texelSize: number
): GodotSurface {
  const built = builtSurfaces.get(mesh);
  if (
    built &&
    built.outlines === face.outlines &&
    built.metrics === face.metrics &&
    built.texelSize === texelSize
  ) {
    return built.surface;
  }
  const surface = finishPrimitiveSurface(
    buildTextMeshSurface(decodeTextMesh(mesh.data), face),
    mesh.data,
    texelSize,
    LIGHTMAP_SIZE_HINT
  );
  builtSurfaces.set(mesh, { outlines: face.outlines, metrics: face.metrics, texelSize, surface });
  return surface;
}
