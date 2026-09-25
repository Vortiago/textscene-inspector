/**
 * Running Godot over a scratch copy of the scene's project, and judging whether
 * it produced anything.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { MAIN_SCENE, bootstrapScript } from './bootstrap.mjs';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, EDITOR_FOV, RENDER_MODES } from './refConstants.mjs';
import { projectConfig, projectViewportSizeFromIni, resolveProjectRoot } from './refProject.mjs';

function runGodot(args, { display }) {
  const command = display ? 'xvfb-run' : 'godot';
  const argv = display ? ['-a', 'godot', ...args] : args;
  const result = spawnSync(command, argv, { encoding: 'utf8', timeout: 300_000 });
  // `error` carries a spawn failure that a null `status` does not name: ENOENT
  // or a timeout. Callers surface it.
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
  sceneCameraPath = null,
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
      lookAt, frame, sceneCamera, sceneCameraPath, mode, boundsOut, fov, fovExplicit });
  } finally {
    // Each run copies the whole res:// root, which a tmpfs /tmp holds in RAM,
    // and every `pnpm test:unit` runs engine-gated tests.
    if (!keepWork) await rm(work, { recursive: true, force: true });
  }
}

async function renderInto(
  work,
  {
    root, scenePath, out, width, height, previews, camera, lookAt, frame, sceneCamera, sceneCameraPath,
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
      sceneCameraPath,
      mode,
      fovExplicit,
      out: resolve(out),
      boundsOut: boundsOut ? resolve(boundsOut) : null,
      modeOut,
      fov,
      canvas2DSize: projectViewportSizeFromIni(sourceIni),
    })
  );
  await writeFile(join(work, '__ref_main.tscn'), MAIN_SCENE);

  // Success is the file existing afterwards, and the default `out` path is
  // reused, so a stale image would pass for this run's result.
  await rm(resolve(out), { force: true });
  if (boundsOut) await rm(resolve(boundsOut), { force: true });

  // Import first, headless: a render resolves textures and meshes from
  // .godot/imported. A failure is not fatal, since a scene may import nothing.
  runGodot(['--headless', '--path', work, '--import'], { display: false });

  const render = runGodot(['--path', work, '--quit-after', '400'], { display: true });
  if (!existsSync(resolve(out))) {
    // The spawn error, which a bare "produced no image" would hide.
    const why = render.error ? `\n${render.error.message}` : '';
    throw new Error(
      `Godot produced no image for ${basename(scenePath)} (exit ${render.status}).${why}\n${render.stdout}\n${render.stderr}`
    );
  }
  const rendered = existsSync(modeOut) ? (await readFile(modeOut, 'utf8')).trim() : null;
  return { workDir: work, out: resolve(out), mode: rendered };
}
