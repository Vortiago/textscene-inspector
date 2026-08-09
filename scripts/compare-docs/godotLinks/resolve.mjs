/** Where a class MIGHT live: the three candidate strategies, each GDCLASS-gated. */

import { defines, makeFetcher } from './headers.mjs';
import { mapPool } from './pool.mjs';

const BLOB_BASE = 'https://github.com/godotengine/godot/blob/master/';

/**
 * Classes the search strategy genuinely cannot reach. Add an entry ONLY after
 * confirming the resolver misses without it — the filename pass, the ancestor
 * pass and the directory sweep already cover most oddly-named headers
 * (SubViewportContainer, StandardMaterial3D and Texture2D all resolve unaided,
 * so they are deliberately NOT listed here).
 *
 * What is left is the case the sweep structurally cannot see: a class whose
 * header lives in a directory none of its ancestors occupy. The CSG module is
 * under modules/csg/ while its ancestors are in scene/3d/; the dialogs are in
 * scene/gui/ while their Window ancestor is in scene/main/.
 *
 * Every entry is still GDCLASS-verified, so a stale one degrades to a loud miss
 * rather than a wrong link.
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
    // A class defined in a sibling's or ancestor's header (OmniLight3D in
    // light_3d.h). Verification is what keeps this from landing on node.h.
    for (const ancestor of chain) {
      for (const p of index.byBasename.get(`${snakeCase(ancestor)}.h`) ?? []) push(p);
    }

    for (const path of candidates) {
      if (defines(await fetchFile(path), name)) return BLOB_BASE + path;
    }

    // Last resort: the class lives in a SIBLING's header, which no amount of
    // walking upwards reaches — PathFollow2D is in path_2d.h, Bone2D in
    // skeleton_2d.h, XRAnchor3D in the grouped xr_nodes.h. Sweep the directories
    // its ancestors live in. Bounded (a handful of dirs) and still GDCLASS-gated.
    const dirs = new Set();
    for (const ancestor of chain) {
      for (const p of index.byBasename.get(`${snakeCase(ancestor)}.h`) ?? []) {
        dirs.add(p.slice(0, p.lastIndexOf('/') + 1));
      }
    }
    // Recursive under each ancestor's directory: Godot groups by subfolder
    // (scene/3d/xr/xr_nodes.h, scene/3d/physics/vehicle_body_3d.h), so a
    // single-level sweep misses them.
    for (const dir of dirs) {
      // RECURSIVE: Godot groups by subfolder, so `scene/3d/` must reach
      // `scene/3d/xr/xr_nodes.h` and `scene/3d/physics/vehicle_body_3d.h`.
      const paths = [...index.byDir]
        .filter(([d]) => d.startsWith(dir))
        .flatMap(([, ps]) => ps)
        .filter((p) => !candidates.includes(p));
      // Warm the whole directory concurrently, then scan in path order. Awaiting
      // each fetch in turn made this a serial chain of cold round trips (~85 for
      // the XR classes) on one worker; the cache makes the scan itself free, and
      // resolution stays deterministic because the ORDER of the scan is unchanged.
      await mapPool(paths, 8, (p) => fetchFile(p));
      for (const path of paths) {
        if (defines(await fetchFile(path), name)) return BLOB_BASE + path;
      }
    }
    return null;
  };
}
