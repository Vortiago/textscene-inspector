/**
 * The scratch Godot project a reference render runs inside: where its `res://`
 * root is, and what its `project.godot` must and must not carry.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CANVAS_2D_CAPTURE } from '../visual/previewServer.mjs';
import { FLATTENED_CORPUS_ROOTS } from '../corpusRoots.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

/**
 * The `res://` root for a scene: the nearest ancestor holding a `project.godot`,
 * else the scene's own directory. `scenes/fixtures` carries no project file on
 * purpose, and its `res://` paths are relative to itself.
 */
export function resolveProjectRoot(scenePath) {
  let dir = dirname(resolve(scenePath));
  const stop = resolve(REPO_ROOT);
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
 * The project's `display/window/size/viewport_*`, or Godot's default pair: the
 * rect a 2D scene is composed against, so the 2D path takes its size from here
 * and the 3D path overrides it. `projectViewportSize` in
 * `parser/projectSettingsParser.ts` is the authority, read here with no build.
 */
export function projectViewportSizeFromIni(sourceIni) {
  const axis = (key, fallback) => {
    const match = new RegExp(`^\\s*window/size/${key}\\s*=\\s*(\\S+)`, 'm').exec(sourceIni ?? '');
    if (!match) return fallback;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  };
  return {
    width: axis('viewport_width', CANVAS_2D_CAPTURE.width),
    height: axis('viewport_height', CANVAS_2D_CAPTURE.height),
  };
}

/**
 * The generated `project.godot`: the source project's settings, which change
 * the picture, minus the default environment and the viewport size.
 */
export function projectConfig(sourceIni, { width, height }) {
  const drop = [
    /^environment\/defaults\/default_environment\s*=/,
    /^rendering\/environment\/defaults\/default_environment\s*=/,
    /^window\/size\/viewport_width\s*=/,
    /^window\/size\/viewport_height\s*=/,
    /^run\/main_scene\s*=/,
    /^config_version\s*=/,
    // Low-processor mode stops a settled scene producing frames, so the
    // bootstrap's `frame_post_draw` await never resumes and the render writes
    // nothing. Godot recommends it for UI projects, which a Control scene is.
    /^run\/low_processor_mode\s*=/,
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
