#!/usr/bin/env node
/**
 * List the Godot node types this previewer does NOT yet render with dedicated
 * support, grouped by dimension (3D / 2D / Other) and by what they do, so it is
 * easy to see what to add next.
 *
 *   node scripts/godot-ref/list-unsupported-nodes.mjs        # -> docs/UNSUPPORTED-NODES.md
 *   node scripts/godot-ref/list-unsupported-nodes.mjs --print
 *
 * The node list is Godot's own ClassDB (via enumerate-nodes.gd through the local
 * `godot` + `xvfb-run`), so re-running this against a newer Godot picks up any
 * nodes a Godot update introduced. "Supported" = a type registered in the node
 * registry (`nodeRegistry.register({ typeName })`); everything else renders only
 * through the generic Node fallback and is listed here.
 *
 * The functional grouping is derived from each class's ancestor chain — Godot's
 * own inheritance — so a new node auto-groups if it extends a known base; a new
 * base falls to "Uncategorized" and wants a GROUP_RULES entry.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../..');
const OUT = join(repoRoot, 'docs/UNSUPPORTED-NODES.md');

// Ordered, specific → general. First base class (or the node's own name) found
// in a node's [name, ...ancestors] decides its group.
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
  ['Node2D', '2D generic'],

  // --- Other (neither CanvasItem nor Node3D) ---
  ['CanvasModulate', 'Canvas effects'],
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

/** Registered node types the previewer renders with dedicated support. */
function supportedTypes() {
  const types = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
      } else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) {
        const text = readFileSync(p, 'utf8');
        for (const m of text.matchAll(/typeName:\s*'([^']+)'/g)) types.add(m[1]);
      }
    }
  };
  walk(join(repoRoot, 'packages/textscene-core/src/nodes'));
  return types;
}

function enumerateGodotNodes() {
  const proj = mkdtempSync(join(tmpdir(), 'godot-nodes-'));
  const gd = join(here, 'enumerate-nodes.gd');
  const res = spawnSync(
    'xvfb-run',
    ['-a', 'godot', '--headless', '--path', proj, '-s', gd],
    { encoding: 'utf8', timeout: 120_000 }
  );
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  const marker = out.indexOf('###NODES_JSON###');
  if (marker === -1) {
    throw new Error(`Godot did not emit the node list. Output:\n${out.slice(-800)}`);
  }
  const json = out.slice(marker + '###NODES_JSON###'.length).trim().split('\n')[0];
  return JSON.parse(json);
}

function groupOf(node) {
  const names = new Set([node.name, ...node.chain]);
  for (const [base, group] of GROUP_RULES) {
    if (names.has(base)) return group;
  }
  // Name-prefix fallbacks for families that share no distinctive base class.
  if (/^(OpenXR|XR)/.test(node.name)) return 'XR / AR';
  if (node.name.startsWith('SpringBone')) return 'Skeleton, bones & IK';
  return 'Uncategorized';
}

function build() {
  const supported = supportedTypes();
  const all = enumerateGodotNodes()
    // Editor-only plugins and engine-internal placeholders are not scene content.
    .filter(
      (n) =>
        !n.name.startsWith('Editor') &&
        !n.name.endsWith('EditorPlugin') &&
        n.name !== 'MissingNode'
    );
  const unsupported = all.filter((n) => !supported.has(n.name));

  const DIMS = ['3D', '2D', 'Other'];
  const lines = [
    '# Unsupported Godot nodes',
    '',
    '> Generated by `scripts/godot-ref/list-unsupported-nodes.mjs` from Godot ' +
      `${godotVersion()}'s ClassDB. Re-run it after a Godot update to refresh.`,
    '',
    `Godot exposes **${all.length}** instantiable scene-node types; this previewer ` +
      `renders **${all.length - unsupported.length}** with dedicated support. The ` +
      `remaining **${unsupported.length}** fall back to a plain Node (transform + ` +
      'children only) and are grouped below by dimension and purpose, as a menu of ' +
      'what to add next.',
    '',
  ];

  for (const dim of DIMS) {
    const inDim = unsupported.filter((n) => n.dim === dim);
    if (!inDim.length) continue;
    lines.push(`## ${dim}${dim === 'Other' ? ' (no transform / non-visual)' : ''}`, '');
    const byGroup = new Map();
    for (const n of inDim) {
      const g = groupOf(n);
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(n.name);
    }
    for (const g of [...byGroup.keys()].sort()) {
      const names = byGroup.get(g).sort();
      lines.push(`### ${g}`, names.map((n) => `- \`${n}\``).join('\n'), '');
    }
  }
  return lines.join('\n');
}

function godotVersion() {
  const res = spawnSync('godot', ['--version'], { encoding: 'utf8' });
  return (res.stdout ?? '').trim().split('\n')[0] || 'unknown';
}

const md = build();
if (process.argv.includes('--print')) {
  console.log(md);
} else {
  writeFileSync(OUT, `${md}\n`);
  console.log(`Wrote ${OUT}`);
}
