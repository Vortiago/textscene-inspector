/**
 * Resolve a Godot class name to its documentation URL and its engine source file.
 *
 * The docs URL is pure derivation. The source path is NOT derivable: OmniLight3D
 * lives in `scene/3d/light_3d.h`, CSGBox3D in `modules/csg/csg_shape.h`. So the
 * candidate is found three ways — snake_case filename, then the class's ancestor
 * chain, then a curated override — and every candidate is then VERIFIED by
 * fetching the file and looking for its `GDCLASS(<Name>,` macro.
 *
 * Verification is the load-bearing part. Existence alone is not enough: an
 * ancestor walk lands on a real-but-wrong header (CSGBox3D would resolve to
 * `visual_instance_3d.h`), and every chain terminates at `node.h`, which always
 * exists — so an existence check can never fail and would emit silent lies. A
 * `class <Name>` substring is not enough either: `scene/resources/material.h:138`
 * is a bare forward declaration `class StandardMaterial3D;`, 774 lines above the
 * definition. Only `GDCLASS(<Name>,` marks the real thing.
 *
 * An unresolved class gets NO `source` field and a loud console.error. A missing
 * link is honest; a wrong one is not.
 */

const TREE_API =
  'https://api.github.com/repos/godotengine/godot/git/trees/master?recursive=1';
const RAW_BASE = 'https://raw.githubusercontent.com/godotengine/godot/master/';
const BLOB_BASE = 'https://github.com/godotengine/godot/blob/master/';

/**
 * Only engine code defines nodes/resources; docs, tests and thirdparty do not.
 * `editor/` is in because a few editor-internal dialogs (ScriptCreateDialog) are
 * still ClassDB nodes and so appear in the catalog.
 */
const SOURCE_ROOTS = ['scene/', 'modules/', 'servers/', 'editor/'];

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

export const docsUrl = (name) =>
  `https://docs.godotengine.org/en/stable/classes/class_${name.toLowerCase()}.html`;

/** Every engine header path, indexed by basename. */
export async function fetchSourceIndex() {
  const res = await fetch(TREE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'textscene-compare-docs' },
  });
  if (!res.ok) throw new Error(`GitHub tree API ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.truncated) throw new Error('GitHub tree response was truncated');

  const byBasename = new Map();
  const byDir = new Map();
  for (const entry of body.tree) {
    if (entry.type !== 'blob' || !entry.path.endsWith('.h')) continue;
    if (!SOURCE_ROOTS.some((r) => entry.path.startsWith(r))) continue;
    const cut = entry.path.lastIndexOf('/') + 1;
    const base = entry.path.slice(cut);
    const dir = entry.path.slice(0, cut);
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base).push(entry.path);
    // Sweeping a directory is a prefix scan over every path otherwise; indexing
    // it here costs one Map and turns that into a lookup.
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(entry.path);
  }
  return { byBasename, byDir };
}

/**
 * Fetch a header once. The PROMISE is cached, not the text, so concurrent
 * resolvers asking for the same file share one request instead of racing.
 * `null` if it does not exist.
 */
/**
 * Fetch a header once. The PROMISE is cached, not the text, so concurrent
 * resolvers asking for the same file share one request instead of racing.
 *
 * Only 404 is a durable answer: it really means "no such header". A 429 or 5xx
 * says nothing about the file, so caching it as `null` would turn one throttled
 * request into a permanent verification failure reported as an upstream rename.
 * Such a path is retried — but a BOUNDED number of times, with backoff. Simply
 * evicting the entry would drop memoisation exactly when the API is rate-limiting
 * and let the directory sweep re-request everything in a loop.
 */
const MAX_ATTEMPTS = 3;

function makeFetcher() {
  const cache = new Map();

  const attempt = async (path, tries) => {
    try {
      const res = await fetch(RAW_BASE + path, {
        headers: { 'User-Agent': 'textscene-compare-docs' },
      });
      if (res.ok) return res.text();
      if (res.status === 404) return null;
      if (tries >= MAX_ATTEMPTS) {
        console.error(`[catalog] ${path}: giving up after ${tries} attempts (HTTP ${res.status})`);
        return null;
      }
    } catch (err) {
      if (tries >= MAX_ATTEMPTS) {
        console.error(`[catalog] ${path}: giving up after ${tries} attempts (${err.message})`);
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 250 * 2 ** (tries - 1)));
    return attempt(path, tries + 1);
  };

  return (path) => {
    let pending = cache.get(path);
    if (!pending) {
      pending = attempt(path, 1);
      cache.set(path, pending);
    }
    return pending;
  };
}

/** Run `task` over `items` with a bounded number in flight. */
export async function mapPool(items, concurrency, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * The class is really DEFINED here, not merely forward-declared or mentioned.
 *
 * Deliberately does NOT match `GDSOFTCLASS(`: if Godot migrates a node to that
 * macro the class becomes a loud unresolved miss, which is the designed failure
 * mode — better than a link nobody re-verified.
 */
const defines = (text, name) =>
  text !== null && new RegExp(`GDCLASS\\(\\s*${name}\\s*,`).test(text);

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
