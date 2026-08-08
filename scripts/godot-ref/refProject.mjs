/**
 * The scratch Godot project a reference render runs inside: where its `res://`
 * root is, and what its `project.godot` must and must not carry.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CANVAS_2D_CAPTURE } from '../visual/previewServer.mjs';
import { FLATTENED_CORPUS_ROOTS } from '../corpusRoots.mjs';

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
 * The source project's `display/window/size/viewport_*`, or Godot's default
 * pair — the rect a 2D scene is COMPOSED against, and what a root Control
 * resolves its anchors to. 23 of the corpus's 81 projects set it
 * (`demos/2d/platformer` is 800x480, `demos/2d/pong` 640x400).
 *
 * This is the case `projectConfig`'s "must not vary" rule does not cover. That
 * rule is about 3D FRAME determinism: the 3D camera renders whatever aspect the
 * harness asks for, so pinning it keeps a 3D reference comparable run to run.
 * A 2D scene is different in kind — the viewport rect is part of the scene's
 * layout, not of the camera, so overriding it composes the scene differently
 * from how Godot would and no amount of matching frame sizes recovers that.
 * The 2D path therefore takes its size from HERE and the 3D path keeps the
 * override.
 *
 * `projectViewportSize` in `parser/projectSettingsParser.ts` is the authority;
 * this is the same two keys read without a build step, as with the localStorage
 * keys in `previewServer.mjs`.
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
