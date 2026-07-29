#!/usr/bin/env node
/**
 * Godot reference-render harness — renders a `.tscn` through the REAL engine so
 * parity questions are answered by measurement instead of derivation.
 *
 *   pnpm ref:godot scenes/fixtures/unit-plane-mesh.tscn --out /tmp/ref.png
 *   pnpm ref:godot scripts/godot-ref/scenes/preview-lighting.tscn \
 *     --camera 0,1.5,4 --look-at 0,0.8,0 --probe 200,8 --probe 200,292
 *
 * `--probe x,y` prints the exact RGB at that pixel, which is what turns "close
 * to Godot" into a number.
 *
 * Requires a local Godot 4.6 (`godot`) and `xvfb-run`; there is no CI copy of
 * either, so this is a developer tool, never a gate.
 *
 * CAMERA: by default this opens where Godot's EDITOR opens every scene —
 * `Node3DEditorViewport::Cursor()`'s fixed orbit at distance 4, fov 70 — which
 * is exactly where the previewer opens it too. So a bare `ref:godot` and a bare
 * `ref:ours` produce the same frame with nothing derived and nothing to keep in
 * sync, and "the pixel at (x, y)" means the same thing on both sides.
 *
 * A scene's own `Camera3D` is IGNORED by default, because the previewer ignores
 * it too: Godot's editor keeps its own free camera and draws the node as a
 * frustum gizmo. `--scene-camera` opts into rendering through it.
 *
 * `--frame` instead fits the scene's geometry bounds the way `frameSceneBounds.ts`
 * does (the previewer's opt-in "frame on open"), for a scene too large to read
 * at distance 4. `--camera` / `--look-at` override everything.
 *
 * 2D: a scene whose root is a CanvasItem (or a CanvasLayer) has no 3D camera to
 * place, and forcing one renders a sky with the scene's Controls laid out
 * against the wrong rectangle. Such a scene renders instead through a
 * SubViewport the size of Godot's project viewport — the same rectangle the
 * previewer's 2D stage draws — so both sides produce the game frame 1:1 and
 * `--width` / `--height` (which size the 3D frame) do not apply. `--mode`
 * forces the choice when the root's type does not settle it.
 *
 * TWO THINGS THIS HARNESS DOES THAT A NAIVE `godot --path` DOES NOT:
 *
 * 1. **It injects the editor previews.** `godot --path` runs the GAME. Godot's
 *    preview sun and preview environment are `Node3DEditor` members and do not
 *    exist at runtime, so a raw render of an unlit scene is black — a picture
 *    Godot never shows the user. The generated bootstrap re-implements
 *    `Node3DEditor::_node_added`'s yield rule (two independent presence checks,
 *    by node type, ignoring `visible`) and `_load_default_preview_settings`'s
 *    values. `--no-previews` renders true runtime semantics instead.
 * 2. **It strips `default_environment`.** A project-level default environment
 *    would light the scene through a channel the previewer has no notion of,
 *    silently biasing every comparison.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { CANVAS_2D_CAPTURE, CANVAS_CAPTURE } from '../visual/previewServer.mjs';
import { FLATTENED_CORPUS_ROOTS } from '../corpusRoots.mjs';

/**
 * The frame `capture-ours.mjs` produces, taken from the one definition of it.
 * Matching it is what makes the two harnesses' probe coordinates address the
 * same surface point with no arguments — differing aspect ratios alone would
 * break that, since at a shared vertical fov the wider frame covers a wider
 * horizontal frustum and no rescaling maps probes 1:1.
 */
const DEFAULT_WIDTH = CANVAS_CAPTURE.width;
const DEFAULT_HEIGHT = CANVAS_CAPTURE.height;

/** `editors/3d/default_fov`. A `Camera3D` node's own default is 75. */
export const EDITOR_FOV = 70;

/**
 * `Node3DEditorViewport::Cursor()` — where the editor opens EVERY scene,
 * whatever is in it. Mirrors `godotEditorCamera.ts`, which is what the
 * previewer opens at, so a bare `ref:godot` and a bare `ref:ours` frame the
 * same picture with no arguments. This file generates GDScript and runs under
 * plain node, so it cannot import the TypeScript — `run.test.mjs` asserts these
 * against `godotEditorCamera.ts` instead, because a one-sided edit here would
 * leave both harnesses "working" while framing different pictures, and every
 * probe measured after that would be quietly wrong.
 */
export const EDITOR_CAMERA_DIRECTION = [0.4207355, 0.4794255, 0.7701512];
export const EDITOR_CAMERA_DISTANCE = 4;

/** `frameSceneBounds.ts`'s margin, for the opt-in framed mode. */
export const FRAME_MARGIN = 1.6;

/** The render modes, and what `--mode` accepts. */
export const RENDER_MODES = ['auto', '2d', '3d'];

/** Godot's preview sun: white, energy 1.0, shadows on, euler (-60°, 150°, 0). */
const PREVIEW_SUN_ALTITUDE_DEG = -60;
const PREVIEW_SUN_AZIMUTH_DEG = 150;

/** `_load_default_preview_settings`'s sky and ground colours. */
const PREVIEW_SKY_TOP = [0.385, 0.454, 0.55];
const PREVIEW_GROUND_BOTTOM = [0.2, 0.169, 0.133];

/** Reject NaN early: it reaches Godot as `viewport_width=NaN`, which does not
 * fail — the engine produces nothing and never exits, so both 300s spawn
 * timeouts elapse before the harness reports an unrelated "produced no image".
 */
function positiveNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} needs a positive number, got "${raw}"`);
  }
  return value;
}

function vec2(flag, raw) {
  const parts = String(raw).split(',').map((n) => Number(n.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`${flag} needs two comma-separated integers, got "${raw}"`);
  }
  return parts;
}

function vec3(flag, raw) {
  const parts = String(raw).split(',').map((n) => Number(n.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${flag} needs three comma-separated numbers, got "${raw}"`);
  }
  return parts;
}

export function parseArgs(argv) {
  const args = {
    scene: null,
    out: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    previews: true,
    // Godot's EDITOR viewport fov (`editors/3d/default_fov`), which is NOT the
    // 75 a bare Camera3D node defaults to. Rendering the reference at 75 while
    // the previewer draws at 70 is a silent zoom difference in every frame.
    fov: EDITOR_FOV,
    fovExplicit: false,
    emitBounds: false,
    frame: false,
    sceneCamera: false,
    // 2D or 3D is a property of the SCENE, not of the invocation, so the
    // engine itself decides by default (`_is_canvas_scene`) — a JS copy of
    // Godot's class hierarchy would be one more pair of constants to keep in
    // sync, and this one cannot be checked by looking at the picture.
    mode: 'auto',
    camera: null,
    lookAt: null,
    probes: [],
    patch: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--width':
        args.width = positiveNumber('--width', argv[++i]);
        break;
      case '--height':
        args.height = positiveNumber('--height', argv[++i]);
        break;
      case '--no-previews':
        args.previews = false;
        break;
      case '--emit-bounds':
        args.emitBounds = true;
        break;
      case '--frame':
        args.frame = true;
        break;
      case '--scene-camera':
        args.sceneCamera = true;
        break;
      case '--mode': {
        const mode = String(argv[++i]).toLowerCase();
        if (!RENDER_MODES.includes(mode)) {
          throw new Error(`--mode takes one of ${RENDER_MODES.join('|')}, got "${mode}"`);
        }
        args.mode = mode;
        break;
      }
      case '--fov':
        args.fov = positiveNumber('--fov', argv[++i]);
        args.fovExplicit = true;
        break;
      case '--camera':
        args.camera = vec3('--camera', argv[++i]);
        break;
      case '--look-at':
        args.lookAt = vec3('--look-at', argv[++i]);
        break;
      case '--probe':
        args.probes.push(vec2('--probe', argv[++i]));
        break;
      case '--patch':
        args.patch = positiveNumber('--patch', argv[++i]);
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}`);
        args.scene = arg;
    }
  }

  return args;
}

/**
 * The `res://` root for a scene: the nearest ancestor holding a `project.godot`
 * (each vendored demo is its own Godot project), else the scene's own directory
 * — `scenes/fixtures` is a flat bag whose `res://` paths are relative to itself
 * and which deliberately carries no project file.
 */
export function resolveProjectRoot(scenePath) {
  let dir = dirname(resolve(scenePath));
  const stop = resolve(join(import.meta.dirname, '..', '..'));
  const unmarkedRoots = FLATTENED_CORPUS_ROOTS.map((r) => resolve(join(stop, 'scenes', r)));
  while (dir.startsWith(stop) && dir !== stop) {
    if (existsSync(join(dir, 'project.godot'))) return dir;
    // A vendored closure that is a res:// root without saying so. Checked while
    // walking, so a scene nested inside one resolves against the corpus rather
    // than against its own folder.
    if (unmarkedRoots.includes(dir)) return dir;
    dir = dirname(dir);
  }
  return dirname(resolve(scenePath));
}

/**
 * The generated `project.godot`. Carries the source project's settings forward
 * (msaa, shadow quality and friends change the picture) minus the two things
 * that must not vary: the default environment, and the viewport size.
 */
export function projectConfig(sourceIni, { width, height }) {
  const drop = [
    /^environment\/defaults\/default_environment\s*=/,
    /^rendering\/environment\/defaults\/default_environment\s*=/,
    /^window\/size\/viewport_width\s*=/,
    /^window\/size\/viewport_height\s*=/,
    /^run\/main_scene\s*=/,
    /^config_version\s*=/,
  ];

  const kept = (sourceIni ?? '')
    .split('\n')
    .filter((line) => !drop.some((re) => re.test(line.trim())))
    .join('\n')
    .trim();

  return [
    'config_version=5',
    '',
    '[application]',
    'run/main_scene="res://__ref_main.tscn"',
    '',
    '[display]',
    `window/size/viewport_width=${width}`,
    `window/size/viewport_height=${height}`,
    '',
    kept,
    '',
  ].join('\n');
}

/**
 * Read back the colour at each probe. `patch` (odd, default 1) samples a
 * square of that side centred on the coordinate and returns the per-channel
 * MEDIAN.
 *
 * A single pixel is not a safe sample across two renderers: ours composites
 * through an antialiased canvas while these references render MSAA-off, so one
 * pixel anywhere near an edge, a silhouette or a shadow boundary carries a
 * blend weight that exists on one side only. The median (not the mean) also
 * discards a stray outlier outright instead of averaging it in.
 */
export function probePixels(buffer, probes, { patch = 1 } = {}) {
  const png = PNG.sync.read(buffer);
  if (!Number.isInteger(patch) || patch < 1 || patch % 2 === 0) {
    // Non-integer (or NaN, from a bad `--patch`) would set a fractional `reach`
    // and read the buffer at mid-pixel byte offsets, returning garbage.
    throw new Error(`patch must be a positive odd integer, got ${patch}`);
  }
  const reach = (patch - 1) / 2;
  return probes.map(([x, y]) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      // A fractional coordinate lands the byte index mid-pixel, so the
      // "colour" returned is the tail of one pixel and the head of the next.
      throw new Error(`probe ${x},${y} must be integer pixel coordinates`);
    }
    if (x - reach < 0 || y - reach < 0 || x + reach >= png.width || y + reach >= png.height) {
      throw new Error(
        `probe ${x},${y} (patch ${patch}) falls outside the ${png.width}x${png.height} image`
      );
    }
    const channels = [[], [], []];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const i = (png.width * (y + dy) + (x + dx)) * 4;
        for (let c = 0; c < 3; c++) channels[c].push(png.data[i + c]);
      }
    }
    return { x, y, rgb: channels.map(median) };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

const gdVec3 = (v) => `Vector3(${v[0]}, ${v[1]}, ${v[2]})`;
const gdColor = (c) => `Color(${c[0]}, ${c[1]}, ${c[2]})`;
/**
 * A GDScript string literal (quotes included) with the special characters
 * escaped, so a path containing a quote, backslash or newline produces valid
 * GDScript instead of a syntax error that never compiles the bootstrap.
 */
const gdString = (s) =>
  `"${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`;

/**
 * The bootstrap scene's script. Instantiates the target scene, picks the 2D or
 * 3D path for it, and writes one settled frame.
 */
function bootstrapScript({
  scenePath,
  previews,
  camera,
  lookAt,
  frame,
  sceneCamera,
  mode,
  out,
  boundsOut,
  modeOut,
  fov,
  fovExplicit,
}) {
  return `extends Node3D

const SCENE_PATH := ${gdString(scenePath)}
const PREVIEWS := ${previews ? 'true' : 'false'}
const OUT := ${gdString(out)}
const BOUNDS_OUT := ${gdString(boundsOut ?? '')}
const MODE_OUT := ${gdString(modeOut)}
const MODE := "${mode}"
const SCENE_CAMERA := ${sceneCamera ? 'true' : 'false'}
const FOV := ${fov}
const CANVAS_2D_SIZE := Vector2i(${CANVAS_2D_CAPTURE.width}, ${CANVAS_2D_CAPTURE.height})
const CLEAR_2D := ${gdColor(CANVAS_2D_CAPTURE.clearColor)}

func _ready() -> void:
	var target: Node = load(SCENE_PATH).instantiate()
	var two_d := MODE == "2d" or (MODE == "auto" and _is_canvas_scene(target))
	# Written before the render, so a run that dies mid-frame still says which
	# path it took — the caller pairs our image with the previewer's on it.
	_write_mode(two_d)
	if two_d:
		await _render_2d(target)
	else:
		await _render_3d(target)
	get_tree().quit()

# Godot's CanvasItemEditor claims a CanvasItem root, which is the rule
# workspaceForScene.ts mirrors — plus CanvasLayer, which is a plain Node that
# exists only to host CanvasItems, and which the previewer counts as 2D too.
func _is_canvas_scene(target: Node) -> bool:
	return target is CanvasItem or target is CanvasLayer

func _render_3d(target: Node) -> void:
	add_child(target)
	_freeze_game_logic(target)
	if PREVIEWS:
		_apply_preview_lighting(target)
	_place_camera(target)
	await _settle()
	get_viewport().get_texture().get_image().save_png(OUT)
	_write_bounds(target)

# A 2D scene has nothing to point a camera at: Godot draws it through the
# canvas transform into the PROJECT VIEWPORT rectangle, and a Control resolves
# its anchors against that rectangle — so the frame size is part of the picture,
# not a capture setting. Rendering into a SubViewport of exactly that size gives
# the game frame 1:1 whatever the window is, which is the rectangle the
# previewer's 2D stage draws. No preview sun or environment: those are
# Node3DEditor's, and 2D lighting is a scene's own business.
func _render_2d(target: Node) -> void:
	RenderingServer.set_default_clear_color(CLEAR_2D)
	var vp := SubViewport.new()
	vp.size = CANVAS_2D_SIZE
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	if not SCENE_CAMERA:
		_disable_2d_cameras(target)
	vp.add_child(target)
	_freeze_game_logic(target)
	await _settle()
	vp.get_texture().get_image().save_png(OUT)

# An enabled Camera2D becomes current the moment it enters the tree and offsets
# the whole canvas transform. The previewer ignores a scene's camera (Godot's
# editor keeps its own view and draws the node as a gizmo), so the reference has
# to as well — disabled BEFORE the subtree is added, since a camera that has
# already claimed the viewport leaves its offset behind.
func _disable_2d_cameras(node: Node) -> void:
	var camera := node as Camera2D
	if camera != null:
		camera.enabled = false
	for child in node.get_children():
		_disable_2d_cameras(child)

# The reference must show the AUTHORED pose, not a running game. _settle() steps
# six process frames, which would let RigidBody physics FALL and autoplay /
# AnimationTree clips ADVANCE past their rest pose. The Node3DEditor preview our
# previewer mirrors never runs game logic, so we freeze it before settling: a
# RigidBody stays where it was authored, animation stays at frame zero. Called
# after the subtree is in the tree (autoplay has queued but not yet sampled) so
# stop() cancels it before the first frame. GPUParticles are left alone — their
# preprocessed burst is the authored look, not running game logic.
func _freeze_game_logic(node: Node) -> void:
	if node is RigidBody3D:
		(node as RigidBody3D).freeze = true
	if node is RigidBody2D:
		(node as RigidBody2D).freeze = true
	if node is AnimationPlayer:
		(node as AnimationPlayer).stop()
	if node is AnimationTree:
		(node as AnimationTree).active = false
	if node is SoftBody3D:
		# SoftBody3D has no freeze property; its cloth/mesh is integrated by the
		# physics server every process frame and sags away from the authored rest
		# mesh the previewer shows. Disabling the node stops that integration,
		# holding it at rest (the freeze equivalent for a soft body).
		(node as SoftBody3D).process_mode = Node.PROCESS_MODE_DISABLED
	for child in node.get_children():
		_freeze_game_logic(child)

func _settle() -> void:
	for _i in 6:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw

func _write_mode(two_d: bool) -> void:
	if MODE_OUT == "":
		return
	var file := FileAccess.open(MODE_OUT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string("2d" if two_d else "3d")
	file.close()

# The scene's world-space AABB, so a comparison can derive ONE camera both
# renderers use rather than each framing the scene its own way.
func _write_bounds(target: Node) -> void:
	if BOUNDS_OUT == "":
		return
	var b := _scene_bounds(target)
	var file := FileAccess.open(BOUNDS_OUT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({
		"position": [b.position.x, b.position.y, b.position.z],
		"size": [b.size.x, b.size.y, b.size.z],
	}))
	file.close()

# Node3DEditor::_node_added — two INDEPENDENT presence checks, by node type,
# with no regard for visibility.
func _contains(node: Node, want_light: bool) -> bool:
	if want_light:
		if node is DirectionalLight3D:
			return true
	elif node is WorldEnvironment:
		return true
	for child in node.get_children():
		if _contains(child, want_light):
			return true
	return false

func _apply_preview_lighting(target: Node) -> void:
	if not _contains(target, true):
		var sun := DirectionalLight3D.new()
		sun.light_color = Color(1, 1, 1)
		sun.light_energy = 1.0
		sun.shadow_enabled = true
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
		sun.directional_shadow_max_distance = 100.0
		sun.transform = Transform3D(
			Basis.from_euler(Vector3(deg_to_rad(${PREVIEW_SUN_ALTITUDE_DEG}), deg_to_rad(${PREVIEW_SUN_AZIMUTH_DEG}), 0.0)),
			Vector3.ZERO
		)
		add_child(sun)

	if not _contains(target, false):
		var sky_material := ProceduralSkyMaterial.new()
		var sky_top := ${gdColor(PREVIEW_SKY_TOP)}
		var ground_bottom := ${gdColor(PREVIEW_GROUND_BOTTOM)}
		# Node3DEditor::_preview_settings_changed derives the horizon from the
		# two authored colours, then pushes it halfway to its own luminance.
		var hz: Color = sky_top.lerp(ground_bottom, 0.5)
		var hz_lum: float = hz.get_luminance() * 3.333
		hz = hz.lerp(Color(hz_lum, hz_lum, hz_lum), 0.5)
		sky_material.sky_top_color = sky_top
		sky_material.sky_horizon_color = hz
		sky_material.ground_bottom_color = ground_bottom
		sky_material.ground_horizon_color = hz
		sky_material.energy_multiplier = 1.0

		var sky := Sky.new()
		sky.sky_material = sky_material

		var env := Environment.new()
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		env.glow_enabled = true

		var world_env := WorldEnvironment.new()
		world_env.environment = env
		add_child(world_env)

func _place_camera(target: Node) -> void:
${
  camera
    ? `	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = FOV
	cam.global_position = ${gdVec3(camera)}
	cam.look_at(${gdVec3(lookAt ?? [0, 0, 0])}, Vector3.UP)
	cam.make_current()`
    : `${
        sceneCamera
          ? `	var existing := _find_camera(target)
	if existing != null:
${
  fovExplicit
    ? `		existing.fov = FOV
`
    : `		# Leave the authored fov alone — a Camera3D defaults to 75, and forcing
		# the editor's 70 would render neither what Godot shows through this
		# camera nor what the previewer shows when the user picks it.
`
}		return
`
          : ''
      }	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = FOV
${
  frame
    ? `	var bounds := _scene_bounds(target)
	var span: float = maxf(maxf(bounds.size.x, bounds.size.y), bounds.size.z)
	var distance := (span / 2.0 / tan(deg_to_rad(FOV) / 2.0)) * ${FRAME_MARGIN}
	var focus := bounds.get_center()`
    : `	var distance := float(${EDITOR_CAMERA_DISTANCE})
	var focus := Vector3.ZERO`
}
	cam.global_position = focus + ${gdVec3(EDITOR_CAMERA_DIRECTION)} * distance
	cam.look_at(focus, Vector3.UP)
	cam.make_current()`
}

func _find_camera(node: Node) -> Camera3D:
	if node is Camera3D:
		return node
	for child in node.get_children():
		var found := _find_camera(child)
		if found != null:
			return found
	return null

# Bounds over GEOMETRY, with everything else only as a fallback — the same rule
# frameSceneBounds.ts applies (meshes first, gizmos only when there are no
# meshes). It has to be the same rule, because the whole point of these bounds
# is to derive ONE camera both renderers use: Light3D and friends are
# VisualInstance3D too, so unioning every visual pulls the centre towards a
# light the previewer never framed on. A sun 5 units up moved the derived
# look-at by 3 units.
func _scene_bounds(node: Node) -> AABB:
	var geometry: Variant = _union(_visuals(node, true))
	if geometry != null:
		return geometry
	var any: Variant = _union(_visuals(node, false))
	if any != null:
		return any
	return AABB(Vector3(-1, -1, -1), Vector3(2, 2, 2))

func _union(visuals: Array) -> Variant:
	var bounds := AABB()
	var seeded := false
	for visual: VisualInstance3D in visuals:
		var world: AABB = visual.global_transform * visual.get_aabb()
		if seeded:
			bounds = bounds.merge(world)
		else:
			bounds = world
			seeded = true
	return bounds if seeded else null

func _visuals(node: Node, geometry_only: bool) -> Array:
	var found: Array = []
	if node is GeometryInstance3D or (not geometry_only and node is VisualInstance3D):
		found.append(node)
	for child in node.get_children():
		found.append_array(_visuals(child, geometry_only))
	return found
`;
}

const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://__ref_bootstrap.gd" id="1"]

[node name="ReferenceRoot" type="Node3D"]
script = ExtResource("1")
`;

function runGodot(args, { display }) {
  const command = display ? 'xvfb-run' : 'godot';
  const argv = display ? ['-a', 'godot', ...args] : args;
  const result = spawnSync(command, argv, { encoding: 'utf8', timeout: 300_000 });
  // `error` carries a spawn failure (ENOENT when godot/xvfb-run is missing, or a
  // timeout) that `status` alone (null in that case) does not — callers surface it.
  return {
    status: result.status,
    error: result.error ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Renders `scene` to `out`. Mirrors the project into a scratch directory rather
 * than rendering in place: Godot writes `.godot/` caches and `*.import`
 * sidecars next to whatever it opens, and the repo is not a Godot project.
 */
export async function renderReference({
  scene,
  out,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  previews = true,
  camera = null,
  lookAt = null,
  frame = false,
  sceneCamera = false,
  mode = 'auto',
  boundsOut = null,
  fov = EDITOR_FOV,
  fovExplicit = false,
  keepWork = false,
}) {
  const scenePath = resolve(scene);
  if (!existsSync(scenePath)) throw new Error(`No such scene: ${scenePath}`);
  if (!RENDER_MODES.includes(mode)) {
    throw new Error(`mode must be one of ${RENDER_MODES.join('|')}, got "${mode}"`);
  }

  const root = resolveProjectRoot(scenePath);
  const work = await mkdtemp(join(tmpdir(), 'godot-ref-'));
  try {
    return await renderInto(work, { root, scenePath, out, width, height, previews, camera,
      lookAt, frame, sceneCamera, mode, boundsOut, fov, fovExplicit });
  } finally {
    // Each run copies the whole res:// root, and `keepWork` is the only reason
    // to hold one afterwards. On a tmpfs /tmp these accumulate in RAM: 236 of
    // them, ~260MB, had piled up on the development host before this cleanup
    // existed — and the engine-gated tests now run inside `pnpm test:unit`,
    // so every suite run added more.
    if (!keepWork) await rm(work, { recursive: true, force: true });
  }
}

async function renderInto(
  work,
  {
    root, scenePath, out, width, height, previews, camera, lookAt, frame, sceneCamera,
    mode, boundsOut, fov, fovExplicit,
  }
) {
  await cp(root, work, { recursive: true, dereference: true });
  // Inside the scratch project, not beside the image: the mode is how the
  // caller pairs this render with the previewer's, not an artefact to keep.
  const modeOut = join(work, '__ref_mode.txt');

  const sourceIni = existsSync(join(root, 'project.godot'))
    ? await readFile(join(root, 'project.godot'), 'utf8')
    : null;
  await writeFile(join(work, 'project.godot'), projectConfig(sourceIni, { width, height }));

  const resPath = `res://${relative(root, scenePath).split(sep).join('/')}`;
  await writeFile(
    join(work, '__ref_bootstrap.gd'),
    bootstrapScript({
      scenePath: resPath,
      previews,
      camera,
      lookAt,
      frame,
      sceneCamera,
      mode,
      fovExplicit,
      out: resolve(out),
      boundsOut: boundsOut ? resolve(boundsOut) : null,
      modeOut,
      fov,
    })
  );
  await writeFile(join(work, '__ref_main.tscn'), MAIN_SCENE);

  // Delete any prior image at these paths BEFORE rendering. Success is judged by
  // the file existing afterwards; the default `out` path is reused across runs, so
  // a stale image from an earlier render would otherwise be reported as this run's
  // result if Godot now crashes/times out — the exact silent-wrong-measurement this
  // tool exists to prevent.
  await rm(resolve(out), { force: true });
  if (boundsOut) await rm(resolve(boundsOut), { force: true });

  // Import first, headless: textures and meshes must exist as .godot/imported
  // artefacts before a render can resolve them. Failures here are not fatal —
  // a scene with no importable assets legitimately has nothing to do.
  runGodot(['--headless', '--path', work, '--import'], { display: false });

  const render = runGodot(['--path', work, '--quit-after', '400'], { display: true });
  if (!existsSync(resolve(out))) {
    // Surface the spawn error (missing godot/xvfb-run, timeout) that a bare
    // "produced no image" would otherwise hide with empty stderr.
    const why = render.error ? `\n${render.error.message}` : '';
    throw new Error(
      `Godot produced no image for ${basename(scenePath)} (exit ${render.status}).${why}\n${render.stdout}\n${render.stderr}`
    );
  }
  const rendered = existsSync(modeOut) ? (await readFile(modeOut, 'utf8')).trim() : null;
  return { workDir: work, out: resolve(out), mode: rendered };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene) {
    console.error('usage: pnpm ref:godot <scene.tscn> [--out png] [--camera x,y,z]');
    console.error(
      '       [--look-at x,y,z] [--probe x,y] [--patch n] [--no-previews] [--width n] [--height n]'
    );
    console.error(
      `       [--mode ${RENDER_MODES.join('|')}]  (2d renders the project viewport, ` +
        `${CANVAS_2D_CAPTURE.width}x${CANVAS_2D_CAPTURE.height}; --width/--height size the 3D frame)`
    );
    process.exit(2);
  }

  const out = args.out ?? join(import.meta.dirname, 'output', `${basename(args.scene, '.tscn')}.png`);
  await mkdir(dirname(out), { recursive: true });
  const boundsOut = args.emitBounds ? out.replace(/\.png$/, '.bounds.json') : null;
  const { out: written, mode } = await renderReference({ ...args, out, boundsOut });
  console.log(`Rendered ${written}${mode ? ` (${mode})` : ''}`);
  if (boundsOut && existsSync(boundsOut)) console.log(`Bounds ${boundsOut}`);

  if (args.probes.length > 0) {
    const buffer = await readFile(written);
    for (const { x, y, rgb } of probePixels(buffer, args.probes, { patch: args.patch })) {
      console.log(`  probe ${x},${y} → rgb(${rgb.join(', ')})`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
