/**
 * The reference side of an animated capture: real Godot, run over a scratch
 * copy of the scene's project, writing one PNG per sampled time.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { projectConfig, resolveProjectRoot } from '../../godot-ref/run.mjs';
import { CANVAS_2D_CAPTURE, CANVAS_CAPTURE } from '../../visual/previewServer.mjs';
import { FRAMES } from './clip.mjs';
import { godotBootstrap, godotBootstrap2D } from './godotBootstrap.mjs';
import { REPO_ROOT } from './paths.mjs';

export async function captureGodotFrames(fixture, framesDir, mode) {
  const scenePath = resolve(REPO_ROOT, 'scenes/fixtures', fixture);
  if (!existsSync(scenePath)) throw new Error(`No such fixture: ${scenePath}`);
  const root = resolveProjectRoot(scenePath);
  const work = await mkdtemp(join(tmpdir(), 'godot-anim-'));
  try {
    await cp(root, work, { recursive: true, dereference: true });
    const ini = existsSync(join(root, 'project.godot'))
      ? await readFile(join(root, 'project.godot'), 'utf8')
      : null;
    // A 3D animation renders Godot at the SAME frame the previewer's canvas
    // produces (CANVAS_CAPTURE), exactly as the still-3D comparison does, so the
    // two GIFs share a size/aspect and the gallery slider overlays them 1:1
    // instead of stretching ours into Godot's differently-shaped box.
    const size =
      mode === '2d'
        ? { width: CANVAS_2D_CAPTURE.width, height: CANVAS_2D_CAPTURE.height }
        : { width: CANVAS_CAPTURE.width, height: CANVAS_CAPTURE.height };
    const config = projectConfig(ini, size).replace(
      /run\/main_scene="[^"]*"/,
      'run/main_scene="res://__anim_main.tscn"'
    );
    await writeFile(join(work, 'project.godot'), config);
    const resPath = `res://${relative(root, scenePath).split(sep).join('/')}`;
    const bootstrap = mode === '2d' ? godotBootstrap2D : godotBootstrap;
    const rootType = mode === '2d' ? 'Node' : 'Node3D';
    await writeFile(join(work, '__anim.gd'), bootstrap(resPath, framesDir));
    await writeFile(
      join(work, '__anim_main.tscn'),
      `[gd_scene load_steps=2 format=3]\n[ext_resource type="Script" path="res://__anim.gd" id="1"]\n[node name="Root" type="${rootType}"]\nscript = ExtResource("1")\n`
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
