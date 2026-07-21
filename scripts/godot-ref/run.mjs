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
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;

/** Godot's preview sun: white, energy 1.0, shadows on, euler (-60°, 150°, 0). */
const PREVIEW_SUN_ALTITUDE_DEG = -60;
const PREVIEW_SUN_AZIMUTH_DEG = 150;

/** `_load_default_preview_settings`'s sky and ground colours. */
const PREVIEW_SKY_TOP = [0.385, 0.454, 0.55];
const PREVIEW_GROUND_BOTTOM = [0.2, 0.169, 0.133];

function vec3(flag, raw) {
  const parts = raw.split(',').map((n) => Number(n.trim()));
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
    camera: null,
    lookAt: null,
    probes: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--width':
        args.width = Number(argv[++i]);
        break;
      case '--height':
        args.height = Number(argv[++i]);
        break;
      case '--no-previews':
        args.previews = false;
        break;
      case '--camera':
        args.camera = vec3('--camera', argv[++i]);
        break;
      case '--look-at':
        args.lookAt = vec3('--look-at', argv[++i]);
        break;
      case '--probe': {
        const [x, y] = vec3('--probe', `${argv[++i]},0`);
        args.probes.push([x, y]);
        break;
      }
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
  while (dir.startsWith(stop) && dir !== stop) {
    if (existsSync(join(dir, 'project.godot'))) return dir;
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

export function probePixels(buffer, probes) {
  const png = PNG.sync.read(buffer);
  return probes.map(([x, y]) => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
      throw new Error(`probe ${x},${y} is outside the ${png.width}x${png.height} image`);
    }
    const i = (png.width * y + x) * 4;
    return { x, y, rgb: [png.data[i], png.data[i + 1], png.data[i + 2]] };
  });
}

const gdVec3 = (v) => `Vector3(${v[0]}, ${v[1]}, ${v[2]})`;
const gdColor = (c) => `Color(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * The bootstrap scene's script. Instantiates the target scene, applies Godot's
 * editor-preview yield rule, frames a camera, and writes one settled frame.
 */
function bootstrapScript({ scenePath, previews, camera, lookAt, out }) {
  return `extends Node3D

const SCENE_PATH := "${scenePath}"
const PREVIEWS := ${previews ? 'true' : 'false'}
const OUT := "${out}"

func _ready() -> void:
	var target: Node = load(SCENE_PATH).instantiate()
	add_child(target)
	if PREVIEWS:
		_apply_preview_lighting(target)
	_place_camera(target)
	for _i in 6:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OUT)
	get_tree().quit()

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
	cam.global_position = ${gdVec3(camera)}
	cam.look_at(${gdVec3(lookAt ?? [0, 0, 0])}, Vector3.UP)
	cam.make_current()`
    : `	if _find_camera(target) != null:
		return
	var cam := Camera3D.new()
	add_child(cam)
	var bounds := _scene_bounds(target)
	var size: float = maxf(bounds.size.length(), 1.0)
	cam.global_position = bounds.get_center() + Vector3(0.7, 0.6, 1.0).normalized() * size * 1.4
	cam.look_at(bounds.get_center(), Vector3.UP)
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

func _scene_bounds(node: Node) -> AABB:
	var bounds := AABB()
	var seeded := false
	for visual: VisualInstance3D in _visuals(node):
		var world: AABB = visual.global_transform * visual.get_aabb()
		if seeded:
			bounds = bounds.merge(world)
		else:
			bounds = world
			seeded = true
	if not seeded:
		return AABB(Vector3(-1, -1, -1), Vector3(2, 2, 2))
	return bounds

func _visuals(node: Node) -> Array:
	var found: Array = []
	if node is VisualInstance3D:
		found.append(node)
	for child in node.get_children():
		found.append_array(_visuals(child))
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
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
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
}) {
  const scenePath = resolve(scene);
  if (!existsSync(scenePath)) throw new Error(`No such scene: ${scenePath}`);

  const root = resolveProjectRoot(scenePath);
  const work = await mkdtemp(join(tmpdir(), 'godot-ref-'));
  await cp(root, work, { recursive: true, dereference: true });

  const sourceIni = existsSync(join(root, 'project.godot'))
    ? await readFile(join(root, 'project.godot'), 'utf8')
    : null;
  await writeFile(join(work, 'project.godot'), projectConfig(sourceIni, { width, height }));

  const resPath = `res://${relative(root, scenePath).split(sep).join('/')}`;
  await writeFile(
    join(work, '__ref_bootstrap.gd'),
    bootstrapScript({ scenePath: resPath, previews, camera, lookAt, out: resolve(out) })
  );
  await writeFile(join(work, '__ref_main.tscn'), MAIN_SCENE);

  // Import first, headless: textures and meshes must exist as .godot/imported
  // artefacts before a render can resolve them. Failures here are not fatal —
  // a scene with no importable assets legitimately has nothing to do.
  runGodot(['--headless', '--path', work, '--import'], { display: false });

  const render = runGodot(['--path', work, '--quit-after', '400'], { display: true });
  if (!existsSync(resolve(out))) {
    throw new Error(
      `Godot produced no image for ${basename(scenePath)}.\n${render.stdout}\n${render.stderr}`
    );
  }
  return { workDir: work, out: resolve(out) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene) {
    console.error('usage: pnpm ref:godot <scene.tscn> [--out png] [--camera x,y,z]');
    console.error('       [--look-at x,y,z] [--probe x,y] [--no-previews] [--width n] [--height n]');
    process.exit(2);
  }

  const out = args.out ?? join(import.meta.dirname, 'output', `${basename(args.scene, '.tscn')}.png`);
  await mkdir(dirname(out), { recursive: true });
  const { out: written } = await renderReference({ ...args, out });
  console.log(`Rendered ${written}`);

  if (args.probes.length > 0) {
    const buffer = await readFile(written);
    for (const { x, y, rgb } of probePixels(buffer, args.probes)) {
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
