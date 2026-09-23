/** Where a class might live: the candidate strategies, each GDCLASS-gated. */

import { defines, makeFetcher } from './headers.mjs';
import { mapPool } from './pool.mjs';

const BLOB_BASE = 'https://github.com/godotengine/godot/blob/master/';

/**
 * Classes whose header lives in a directory none of their ancestors occupy, so
 * the sweep cannot reach them. Add one only after the resolver misses it:
 * SubViewportContainer, StandardMaterial3D and Texture2D resolve unaided. Each
 * entry is still GDCLASS-verified, so a stale one is a loud miss.
 */
const OVERRIDES = {
  CSGBox3D: 'modules/csg/csg_shape.h',
  CSGCombiner3D: 'modules/csg/csg_shape.h',
  CSGCylinder3D: 'modules/csg/csg_shape.h',
  CSGMesh3D: 'modules/csg/csg_shape.h',
  CSGPolygon3D: 'modules/csg/csg_shape.h',
  CSGPrimitive3D: 'modules/csg/csg_shape.h',
  CSGShape3D: 'modules/csg/csg_shape.h',
  CSGSphere3D: 'modules/csg/csg_shape.h',
  CSGTorus3D: 'modules/csg/csg_shape.h',
  AcceptDialog: 'scene/gui/dialogs.h',
  ConfirmationDialog: 'scene/gui/dialogs.h',
};

const snakeCase = (name) =>
  name
    // Godot keeps this acronym whole in filenames: OpenXRHand -> openxr_hand,
    // where the generic rule below would split it to open_xr_hand.
    .replace(/^OpenXR/, 'Openxr')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // GPUParticles -> GPU_Particles
    .replace(/([a-z])([A-Z])/g, '$1_$2') // OmniLight -> Omni_Light
    .replace(/([a-zA-Z])([0-9])/g, '$1_$2') // Light3D -> Light_3D
    .toLowerCase();

/**
 * Resolve one class. `chain` is its ancestor list (nearest first), as ClassDB
 * reports it; pass `[]` when unknown and only the filename and override paths
 * are tried.
 */
export function makeResolver(index) {
  const fetchFile = makeFetcher();

  return async function resolve(name, chain = []) {
    const candidates = [];
    const push = (p) => {
      if (p && !candidates.includes(p)) candidates.push(p);
    };

    if (OVERRIDES[name]) push(OVERRIDES[name]);
    for (const p of index.byBasename.get(`${snakeCase(name)}.h`) ?? []) push(p);
    // A class defined in an ancestor's header (OmniLight3D in light_3d.h).
    // Verification keeps this from landing on node.h.
    for (const ancestor of chain) {
      for (const p of index.byBasename.get(`${snakeCase(ancestor)}.h`) ?? []) push(p);
    }

    for (const path of candidates) {
      if (defines(await fetchFile(path), name)) return BLOB_BASE + path;
    }

    // Last resort: a sibling's header, which the upward walk never reaches
    // (PathFollow2D in path_2d.h, Bone2D in skeleton_2d.h, XRAnchor3D in
    // xr_nodes.h). This sweeps the directories the ancestors live in.
    const dirs = new Set();
    for (const ancestor of chain) {
      for (const p of index.byBasename.get(`${snakeCase(ancestor)}.h`) ?? []) {
        dirs.add(p.slice(0, p.lastIndexOf('/') + 1));
      }
    }
    for (const dir of dirs) {
      // Recursive: Godot groups by subfolder, so `scene/3d/` must reach
      // `scene/3d/xr/xr_nodes.h` and `scene/3d/physics/vehicle_body_3d.h`.
      const paths = [...index.byDir]
        .filter(([d]) => d.startsWith(dir))
        .flatMap(([, ps]) => ps)
        .filter((p) => !candidates.includes(p));
      // Warm the directory concurrently, then scan in path order, so the result
      // stays deterministic without a serial chain of cold round trips.
      await mapPool(paths, 8, (p) => fetchFile(p));
      for (const path of paths) {
        if (defines(await fetchFile(path), name)) return BLOB_BASE + path;
      }
    }
    return null;
  };
}
