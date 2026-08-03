#!/usr/bin/env node
/**
 * Build the node catalog the comparison gallery uses to place EVERY Godot node —
 * supported or not — in the left menu, grouped by dimension (3D / 2D / Other) and
 * by what it does (lighting, physics, particles, UI, …). Unsupported nodes show
 * up in the gallery as "Not implemented" sheets; there is no separate list to
 * maintain.
 *
 *   pnpm nodes:catalog        # -> scripts/compare-docs/node-catalog.json
 *
 * The node list is Godot's own ClassDB (via enumerate-nodes.gd through the local
 * `godot` + `xvfb-run`), so re-running against a newer Godot picks up any nodes a
 * Godot update introduced. "Supported" is read from the live `nodeRegistry` in
 * the built package, so this needs `pnpm --filter @textscene/core build` first.
 * The functional grouping is derived from
 * each class's ancestor chain, so a new node auto-groups if it extends a known
 * base; a genuinely novel base falls to "Uncategorized" and wants a GROUP_RULES
 * entry.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsUrl, fetchSourceIndex, makeResolver, mapPool } from './godotLinks.mjs';
import { loadCoreParser } from './loadCoreLinter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../..');
const OUT = join(here, 'node-catalog.json');
const ENUM_GD = join(repoRoot, 'scripts/godot-ref/enumerate-nodes.gd');

// Ordered, specific → general. First base class (or the node's own name) found in
// a node's [name, ...ancestors] decides its group.
const GROUP_RULES = [
  // --- 3D ---
  ['Light3D', 'Lighting'],
  ['ReflectionProbe', 'Reflection & global illumination'],
  ['VoxelGI', 'Reflection & global illumination'],
  ['LightmapGI', 'Reflection & global illumination'],
  ['LightmapProbe', 'Reflection & global illumination'],
  ['FogVolume', 'Reflection & global illumination'],
  ['Decal', 'Reflection & global illumination'],
  ['GPUParticlesCollision3D', 'Particles'],
  ['GPUParticlesAttractor3D', 'Particles'],
  ['GPUParticles3D', 'Particles'],
  ['CPUParticles3D', 'Particles'],
  ['Joint3D', 'Physics — joints'],
  ['VehicleWheel3D', 'Physics — vehicles'],
  ['SoftBody3D', 'Physics — bodies'],
  ['PhysicalBone3D', 'Physics — bodies'],
  ['PhysicsBody3D', 'Physics — bodies'],
  ['Area3D', 'Physics — areas'],
  ['CollisionObject3D', 'Physics — bodies'],
  ['CollisionShape3D', 'Collision shapes'],
  ['CollisionPolygon3D', 'Collision shapes'],
  ['RayCast3D', 'Physics — queries'],
  ['ShapeCast3D', 'Physics — queries'],
  ['SpringArm3D', 'Physics — queries'],
  ['NavigationRegion3D', 'Navigation'],
  ['NavigationLink3D', 'Navigation'],
  ['NavigationAgent3D', 'Navigation'],
  ['NavigationObstacle3D', 'Navigation'],
  ['Camera3D', 'Cameras'],
  ['AudioListener3D', 'Audio'],
  ['AudioStreamPlayer3D', 'Audio'],
  ['Skeleton3D', 'Skeleton, bones & IK'],
  ['BoneAttachment3D', 'Skeleton, bones & IK'],
  ['SkeletonModifier3D', 'Skeleton, bones & IK'],
  ['BoneConstraint3D', 'Skeleton, bones & IK'],
  ['Path3D', 'Paths & curves'],
  ['PathFollow3D', 'Paths & curves'],
  ['RemoteTransform3D', 'Transform helpers'],
  ['Marker3D', 'Markers & helpers'],
  ['GridMap', 'Tilemaps & grids'],
  ['CSGShape3D', 'CSG'],
  ['MultiMeshInstance3D', 'Meshes & rendering'],
  ['Label3D', 'Meshes & rendering'],
  ['SpriteBase3D', 'Meshes & rendering'],
  ['MeshInstance3D', 'Meshes & rendering'],
  ['GeometryInstance3D', 'Meshes & rendering'],
  ['VisibleOnScreenNotifier3D', 'Visibility'],
  ['VisibleOnScreenEnabler3D', 'Visibility'],
  ['XROrigin3D', 'XR / AR'],
  ['XRNode3D', 'XR / AR'],
  ['XRController3D', 'XR / AR'],
  ['XRAnchor3D', 'XR / AR'],
  ['OpenXRHand', 'XR / AR'],
  ['OpenXRCompositionLayer', 'XR / AR'],
  ['ImporterMeshInstance3D', 'Import / editor internals'],
  ['WorldEnvironment', 'Environment'],
  ['VisualInstance3D', 'Meshes & rendering'],

  // --- 2D ---
  ['Light2D', 'Lighting'],
  ['LightOccluder2D', 'Lighting'],
  ['Joint2D', 'Physics — joints'],
  ['PhysicsBody2D', 'Physics — bodies'],
  ['Area2D', 'Physics — areas'],
  ['CollisionObject2D', 'Physics — bodies'],
  ['CollisionShape2D', 'Collision shapes'],
  ['CollisionPolygon2D', 'Collision shapes'],
  ['RayCast2D', 'Physics — queries'],
  ['ShapeCast2D', 'Physics — queries'],
  ['GPUParticles2D', 'Particles'],
  ['CPUParticles2D', 'Particles'],
  ['NavigationRegion2D', 'Navigation'],
  ['NavigationLink2D', 'Navigation'],
  ['NavigationAgent2D', 'Navigation'],
  ['NavigationObstacle2D', 'Navigation'],
  ['Camera2D', 'Cameras'],
  ['AudioListener2D', 'Audio'],
  ['AudioStreamPlayer2D', 'Audio'],
  ['Skeleton2D', 'Skeleton, bones & IK'],
  ['Bone2D', 'Skeleton, bones & IK'],
  ['Path2D', 'Paths & curves'],
  ['PathFollow2D', 'Paths & curves'],
  ['RemoteTransform2D', 'Transform helpers'],
  ['Marker2D', 'Markers & helpers'],
  ['TileMapLayer', 'Tilemaps & grids'],
  ['TileMap', 'Tilemaps & grids'],
  ['VisibleOnScreenNotifier2D', 'Visibility'],
  ['VisibleOnScreenEnabler2D', 'Visibility'],
  ['Parallax2D', 'Parallax & scrolling'],
  ['ParallaxLayer', 'Parallax & scrolling'],
  ['BackBufferCopy', 'Canvas effects'],
  ['CanvasGroup', 'Canvas effects'],
  ['TouchScreenButton', 'Touch input'],
  ['Container', 'UI — containers'],
  ['Control', 'UI — controls'],
  ['MultiMeshInstance2D', '2D rendering'],
  ['MeshInstance2D', '2D rendering'],
  ['AnimatedSprite2D', '2D rendering'],
  ['Sprite2D', '2D rendering'],
  ['Polygon2D', '2D rendering'],
  ['Line2D', '2D rendering'],
  // CanvasModulate is a Node2D, so its specific rule must precede the Node2D
  // catch-all below — order is most-specific-first.
  ['CanvasModulate', 'Canvas effects'],
  ['Node2D', '2D generic'],

  // --- Other (neither CanvasItem nor Node3D) ---
  ['CanvasLayer', 'Canvas layers'],
  ['Window', 'UI — windows'],
  ['AnimationPlayer', 'Animation'],
  ['AnimationTree', 'Animation'],
  ['AnimationMixer', 'Animation'],
  ['Tween', 'Animation'],
  ['AudioStreamPlayer', 'Audio'],
  ['Timer', 'Timers & logic'],
  ['HTTPRequest', 'Networking'],
  ['MultiplayerSpawner', 'Networking'],
  ['MultiplayerSynchronizer', 'Networking'],
  ['ResourcePreloader', 'Resources'],
  ['ShaderGlobalsOverride', 'Rendering globals'],
  ['StatusIndicator', 'OS integration'],
  ['XRServer', 'XR / AR'],
  ['SubViewport', 'Viewports'],
  ['SpringBoneCollision3D', 'Skeleton, bones & IK'],
];

/**
 * The types the lenient parser actually recognises, read from the live registry
 * in the built package.
 *
 * This was a `typeName: '…'` scrape of the slice sources, which silently
 * undercounted: `StaticBody2D`, `RigidBody2D` and `CharacterBody2D` are
 * registered by a loop over `TWO_D_PHYSICS_TYPES` with no string literal to
 * match, so the catalog called three shipped types "not implemented". Reading
 * the registry cannot drift from what the parser does, and it is the same
 * source `coverage-report.mjs` uses, so the two agree by construction.
 */
async function supportedTypes() {
  const { nodeRegistry } = await loadCoreParser();
  return new Set(nodeRegistry.getAllTypeNames());
}

function enumerateGodotNodes() {
  const proj = mkdtempSync(join(tmpdir(), 'godot-nodes-'));
  const res = spawnSync('xvfb-run', ['-a', 'godot', '--headless', '--path', proj, '-s', ENUM_GD], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  const marker = out.indexOf('###NODES_JSON###');
  if (marker === -1) throw new Error(`Godot did not emit the node list. Output:\n${out.slice(-800)}`);
  return JSON.parse(out.slice(marker + '###NODES_JSON###'.length).trim().split('\n')[0]);
}

function groupOf(node) {
  const names = new Set([node.name, ...node.chain]);
  for (const [base, group] of GROUP_RULES) if (names.has(base)) return group;
  if (/^(OpenXR|XR)/.test(node.name)) return 'XR / AR';
  if (node.name.startsWith('SpringBone')) return 'Skeleton, bones & IK';
  // Dimension-aware catch-all so a base node (Node3D, Node) or any future node
  // with an unfamiliar base still groups sensibly rather than vanishing.
  if (names.has('Node3D')) return '3D generic';
  if (names.has('CanvasItem')) return '2D generic';
  return 'Generic';
}

function godotVersion() {
  return (spawnSync('godot', ['--version'], { encoding: 'utf8' }).stdout ?? '').trim().split('\n')[0] || 'unknown';
}

/**
 * Classes the previewer documents that the LOCAL Godot's ClassDB does not list —
 * AreaLight3D exists in current Godot but not in 4.6.3, and the links are
 * deliberately unpinned to `stable`/`master`. Without this its sheet is the one
 * gallery entry with no reference chips. An entry self-heals into `nodes` the
 * day the local Godot lists it (see the dedup filter at the call site).
 */
const EXTRA_CLASSES = [
  { name: 'AreaLight3D', chain: ['Light3D', 'VisualInstance3D', 'Node3D', 'Node'] },
];

/**
 * Resource classes the gallery documents. ClassDB's node enumeration does not
 * reach them (they are Resources, not Nodes), but their sheets want the same
 * docs/source chips, and this run is the only place holding the source index.
 * Chains are their Godot ancestry, used the same way as a node's.
 */
const RESOURCE_CLASSES = [
  { name: 'StandardMaterial3D', chain: ['BaseMaterial3D', 'Material', 'Resource'] },
  { name: 'Environment', chain: ['Resource'] },
  { name: 'Sky', chain: ['Resource'] },
  { name: 'Texture2D', chain: ['Texture', 'Resource'] },
  { name: 'ArrayMesh', chain: ['Mesh', 'Resource'] },
];

/**
 * Attach `docs` and `source` to every entry. Source resolution is network-bound
 * and best-effort: on any failure the previous run's value is carried forward
 * rather than dropped, so a flaky network never silently strips the catalog.
 */
async function attachLinks(entries, previousByName) {
  const carryForward = (why) => {
    const noPrevious = entries.filter((e) => !previousByName.get(e.name)?.source).map((e) => e.name);
    console.error(`[catalog] source resolution skipped (${why}); keeping previous values.`);
    if (noPrevious.length) {
      console.error(
        `[catalog] ${noPrevious.length} class(es) have no previous link either and ship sourceless:\n  ${noPrevious.join('\n  ')}`
      );
    }
    return entries.map((e) => {
      const prev = previousByName.get(e.name);
      return { ...e, docs: docsUrl(e.name), ...(prev?.source ? { source: prev.source } : {}) };
    });
  };

  let index;
  try {
    index = await fetchSourceIndex();
  } catch (err) {
    return carryForward(err.message);
  }

  const resolve = makeResolver(index);
  const unresolved = [];
  const carried = [];
  const linked = await mapPool(entries, 8, async (e) => {
    let source;
    try {
      source = await resolve(e.name, e.chain ?? []);
    } catch {
      source = null;
    }
    if (!source) {
      // Fall back to the previous value before giving up, so a transient miss
      // does not delete a link that was already verified. This is reported:
      // an upstream header RENAME also lands here, and carrying the old path
      // silently would ship a 404 forever — the one way this design could still
      // emit a wrong link.
      source = previousByName.get(e.name)?.source ?? null;
      if (source) carried.push(e.name);
      else unresolved.push(e.name);
    }
    // `chain` is persisted: it is real ClassDB ancestry, and without it
    // `--links-only` has nothing to walk and resolves only direct filename hits.
    return { ...e, docs: docsUrl(e.name), ...(source ? { source } : {}) };
  });

  if (carried.length) {
    console.error(
      `[catalog] ${carried.length} class(es) FAILED verification and kept their previous source link — re-check these, the header may have been renamed upstream:\n  ${carried.join('\n  ')}`
    );
  }
  if (unresolved.length) {
    console.error(
      `[catalog] ${unresolved.length} class(es) have NO verified source file and will ship without one:\n  ${unresolved.join('\n  ')}`
    );
  }
  return linked;
}

const linksOnly = process.argv.includes('--links-only');
const previous = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : { nodes: [], resources: [], extras: [] };
const previousByName = new Map(
  [...(previous.nodes ?? []), ...(previous.resources ?? []), ...(previous.extras ?? [])].map((n) => [
    n.name,
    n,
  ])
);

// `--links-only` refreshes the docs/source links against the existing catalog:
// the node list itself needs a local godot + xvfb-run, the links only need the
// network, and they go stale on different schedules.
let nodes;
let godotVersionValue;
if (linksOnly) {
  if (!previous.nodes?.length) throw new Error(`--links-only needs an existing ${OUT}`);
  nodes = previous.nodes.map((n) => {
    const copy = { ...n };
    delete copy.docs;
    delete copy.source;
    return copy;
  });
  if (!nodes.some((n) => n.chain?.length)) {
    throw new Error(
      `${OUT} predates persisted ancestry — run a full \`pnpm nodes:catalog\` once before --links-only.`
    );
  }
  godotVersionValue = previous.godotVersion ?? 'unknown';
} else {
  const supported = await supportedTypes();
  nodes = enumerateGodotNodes()
    // Editor-only plugins and engine-internal placeholders are not scene content.
    .filter((n) => !n.name.startsWith('Editor') && !n.name.endsWith('EditorPlugin') && n.name !== 'MissingNode')
    .map((n) => ({
      name: n.name,
      category: n.dim,
      group: groupOf(n),
      supported: supported.has(n.name),
      chain: n.chain,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  godotVersionValue = godotVersion();
}

// One pass over everything: `attachLinks` downloads the ~4 MB source tree and
// starts a fresh header cache each time it runs, so three calls meant three
// downloads, three slices of the 60/hour API budget, and no cache sharing.
const extras = EXTRA_CLASSES.filter((e) => !nodes.some((n) => n.name === e.name));
const linked = await attachLinks([...nodes, ...RESOURCE_CLASSES, ...extras], previousByName);
const linkedNodes = linked.slice(0, nodes.length);
const linkedResources = linked.slice(nodes.length, nodes.length + RESOURCE_CLASSES.length);
const linkedExtras = linked.slice(nodes.length + RESOURCE_CLASSES.length);

const catalog = {
  godotVersion: godotVersionValue,
  generated: 'pnpm nodes:catalog',
  nodes: linkedNodes,
  resources: linkedResources,
  extras: linkedExtras,
};
writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
const unsupported = linkedNodes.filter((n) => !n.supported).length;
const sourced = linkedNodes.filter((n) => n.source).length;
console.log(
  `Wrote ${OUT} — ${linkedNodes.length} nodes (${linkedNodes.length - unsupported} supported, ${unsupported} not implemented), ${sourced} with a verified source link, plus ${linkedResources.length} resources.`
);
