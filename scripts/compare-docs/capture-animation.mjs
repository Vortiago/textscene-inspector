#!/usr/bin/env node
/**
 * Capture an animated node on both sides as a GIF, for the comparison sheets —
 * the still-image counterpart is `capture.mjs`, but a node whose whole point is
 * motion (AnimationPlayer, and anything it drives) needs to be seen moving.
 *
 *   node scripts/compare-docs/capture-animation.mjs unit-animation-player.tscn
 *
 * Both sides render the SAME clip at the SAME set of times from the editor
 * camera, so frame i is the same moment in each: real Godot seeks its
 * AnimationPlayer and saves a PNG per frame; the previewer selects the player
 * (which is what mounts its transport, ADR-0012), drives the scrubber to each
 * time, and screenshots. The two PNG sequences are encoded to
 * `<image>-godot.gif` and `<image>-ours.gif` beside the stills.
 *
 * 3D only — AnimationPlayer is a 3D node and the reference is framed with the
 * 3D editor camera. Both sides get Godot's editor preview environment (the
 * fixture brings a light but no `WorldEnvironment`), so the sky matches too.
 */
/* global document, window */ // used only inside the page.evaluate callback, which runs in the browser.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import {
  EDITOR_CAMERA_DIRECTION,
  EDITOR_CAMERA_DISTANCE,
  EDITOR_FOV,
  projectConfig,
  resolveProjectRoot,
} from '../godot-ref/run.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';
import { GIFEncoder, applyPalette, quantize } from './vendor/gifenc.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const IMAGES = join(REPO_ROOT, 'docs/comparison/images');
const PORT = Number(process.env.COMPARE_PORT) || 4323;

const FRAMES = 24; // over one loop of the clip
const FPS = 12;
const WIDTH = 640;
const HEIGHT = 512;

// `_load_default_preview_settings`, mirrored from scripts/godot-ref/run.mjs so
// the animated reference gets the same sky as the still one.
const PREVIEW_SUN_ALTITUDE_DEG = -60;
const PREVIEW_SUN_AZIMUTH_DEG = 150;
const PREVIEW_SKY_TOP = '0.385, 0.454, 0.55';
const PREVIEW_GROUND_BOTTOM = '0.2, 0.169, 0.133';

function godotBootstrap(resPath, framesDir) {
  const dir = EDITOR_CAMERA_DIRECTION.map((c) => c * EDITOR_CAMERA_DISTANCE);
  return `extends Node3D

func _ready() -> void:
	var target: Node = load("${resPath}").instantiate()
	add_child(target)
	_apply_preview_environment(target)
	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = ${EDITOR_FOV}
	cam.global_position = Vector3(${dir[0]}, ${dir[1]}, ${dir[2]})
	cam.look_at(Vector3.ZERO, Vector3.UP)
	cam.make_current()
	var ap: AnimationPlayer = target.find_child("AnimationPlayer", true, false)
	if ap == null:
		push_error("no AnimationPlayer in scene")
		get_tree().quit(1)
		return
	var clip: String = ap.autoplay if ap.autoplay != "" else ap.get_animation_list()[0]
	ap.play(clip)
	var length: float = ap.get_animation(clip).length
	for i in ${FRAMES}:
		ap.seek(length * float(i) / ${FRAMES}, true)
		await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("${framesDir}/frame_%02d.png" % i)
	get_tree().quit()

# The editor preview environment (ADR-0025): injected only when the scene has no
# WorldEnvironment of its own, exactly as the still capture does.
func _apply_preview_environment(target: Node) -> void:
	if _has_world_environment(target):
		return
	var sky_material := ProceduralSkyMaterial.new()
	var sky_top := Color(${PREVIEW_SKY_TOP})
	var ground_bottom := Color(${PREVIEW_GROUND_BOTTOM})
	var hz: Color = sky_top.lerp(ground_bottom, 0.5)
	var hz_lum: float = hz.get_luminance() * 3.333
	hz = hz.lerp(Color(hz_lum, hz_lum, hz_lum), 0.5)
	sky_material.sky_top_color = sky_top
	sky_material.sky_horizon_color = hz
	sky_material.ground_bottom_color = ground_bottom
	sky_material.ground_horizon_color = hz
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
	# The fixture supplies its own DirectionalLight3D, so the preview sun yields;
	# add one only if it does not.
	if not _has_directional_light(target):
		var sun := DirectionalLight3D.new()
		sun.shadow_enabled = true
		sun.transform = Transform3D(
			Basis.from_euler(Vector3(deg_to_rad(${PREVIEW_SUN_ALTITUDE_DEG}), deg_to_rad(${PREVIEW_SUN_AZIMUTH_DEG}), 0.0)),
			Vector3.ZERO
		)
		add_child(sun)

func _has_world_environment(node: Node) -> bool:
	if node is WorldEnvironment:
		return true
	for child in node.get_children():
		if _has_world_environment(child):
			return true
	return false

func _has_directional_light(node: Node) -> bool:
	if node is DirectionalLight3D:
		return true
	for child in node.get_children():
		if _has_directional_light(child):
			return true
	return false
`;
}

async function captureGodotFrames(fixture, framesDir) {
  const scenePath = resolve(REPO_ROOT, 'scenes/fixtures', fixture);
  if (!existsSync(scenePath)) throw new Error(`No such fixture: ${scenePath}`);
  const root = resolveProjectRoot(scenePath);
  const work = await mkdtemp(join(tmpdir(), 'godot-anim-'));
  try {
    await cp(root, work, { recursive: true, dereference: true });
    const ini = existsSync(join(root, 'project.godot'))
      ? await readFile(join(root, 'project.godot'), 'utf8')
      : null;
    const config = projectConfig(ini, { width: WIDTH, height: HEIGHT }).replace(
      /run\/main_scene="[^"]*"/,
      'run/main_scene="res://__anim_main.tscn"'
    );
    await writeFile(join(work, 'project.godot'), config);
    const resPath = `res://${relative(root, scenePath).split(sep).join('/')}`;
    await writeFile(join(work, '__anim.gd'), godotBootstrap(resPath, framesDir));
    await writeFile(
      join(work, '__anim_main.tscn'),
      `[gd_scene load_steps=2 format=3]\n[ext_resource type="Script" path="res://__anim.gd" id="1"]\n[node name="Root" type="Node3D"]\nscript = ExtResource("1")\n`
    );
    await mkdir(framesDir, { recursive: true });
    spawnSync('xvfb-run', ['-a', 'godot', '--headless', '--path', work, '--import'], {
      encoding: 'utf8',
      timeout: 300_000,
    });
    const r = spawnSync('xvfb-run', ['-a', 'godot', '--path', work, '--quit-after', String(FRAMES * 20 + 200)], {
      encoding: 'utf8',
      timeout: 300_000,
    });
    const got = (await readdir(framesDir)).filter((f) => /^frame_\d+\.png$/.test(f));
    if (got.length < FRAMES) {
      throw new Error(`Godot wrote ${got.length}/${FRAMES} frames.\n${r.stderr ?? ''}`);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function captureOurFrames(fixture, framesDir) {
  ensureWebBuilt();
  await assertPortFree(PORT, 'COMPARE_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    const context = await createCaptureContext(browser, { frameOnOpen: false });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?fixture=${encodeURIComponent(fixture)}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    // The Animation tab (and its transport) mounts only while the
    // AnimationPlayer is selected (ADR-0012), so select it, then drive the
    // scrubber. The player is a transform-only node at the origin, so its
    // selection draws no box into the frame.
    await page.locator('[aria-label="Expand all"]').click().catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('[role="treeitem"]:has-text("AnimationPlayer")').first().click();
    await page.waitForTimeout(500);

    const scrubber = page.locator('input[type="range"]').first();
    if ((await scrubber.count()) === 0) throw new Error('no animation scrubber after selecting the player');
    const duration = Number(await scrubber.getAttribute('max'));
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`bad scrubber max: ${duration}`);

    await mkdir(framesDir, { recursive: true });
    const canvas = page.locator('canvas').first();
    for (let i = 0; i < FRAMES; i++) {
      const t = (duration * i) / FRAMES;
      // The scrubber is a React-controlled input, so set through the native
      // value setter and fire input/change — .fill() does not drive onChange.
      await page.evaluate((value) => {
        const el = document.querySelector('input[type=range]');
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, t);
      await page.waitForTimeout(220);
      await canvas.screenshot({ path: join(framesDir, `frame_${String(i).padStart(2, '0')}.png`) });
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
}

async function encodeGif(framesDir, outPath) {
  const files = (await readdir(framesDir))
    .filter((f) => /^frame_\d+\.png$/.test(f))
    .sort();
  const gif = GIFEncoder();
  for (const f of files) {
    const png = PNG.sync.read(readFileSync(join(framesDir, f)));
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, png.width, png.height, { palette, delay: Math.round(1000 / FPS) });
  }
  gif.finish();
  writeFileSync(outPath, Buffer.from(gif.bytes()));
}

async function main() {
  const fixture = process.argv[2];
  if (!fixture) {
    console.error('Usage: node scripts/compare-docs/capture-animation.mjs <fixture.tscn>');
    process.exit(2);
  }
  const image = fixture.replace(/\.tscn$/, '');
  const scratch = await mkdtemp(join(tmpdir(), 'anim-frames-'));
  await mkdir(IMAGES, { recursive: true });
  try {
    console.log(`[anim] ${fixture}: capturing Godot frames…`);
    await captureGodotFrames(fixture, join(scratch, 'godot'));
    console.log(`[anim] ${fixture}: capturing our frames…`);
    await captureOurFrames(fixture, join(scratch, 'ours'));
    await encodeGif(join(scratch, 'godot'), join(IMAGES, `${image}-godot.gif`));
    await encodeGif(join(scratch, 'ours'), join(IMAGES, `${image}-ours.gif`));
    console.log(`[anim] wrote ${image}-godot.gif and ${image}-ours.gif to ${IMAGES}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

await main();
