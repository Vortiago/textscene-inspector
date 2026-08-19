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
 * `--mode 2d-root` draws that SAME rectangle as the root WINDOW instead of
 * inside a SubViewport. It exists because a handful of viewport settings are
 * handed to `SceneTree`'s root window and to nothing else, so nothing nested
 * can observe them (`ROOT_ONLY_VIEWPORT_PROPERTIES`). The SubViewport arm stays
 * the default — it owns its rectangle outright, with no window manager or
 * screen size able to reach it — and now REFUSES rather than answering from the
 * class default when a project sets one of those settings.
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
 *
 * `--particles <seconds>` is the third: the editor ANIMATES particles (there is
 * no `is_editor_hint` guard on the process path), so a paused reference draws a
 * pose the editor never sits on. See `PARTICLES_PROCESS_DEFAULT`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { CANVAS_2D_CAPTURE, CANVAS_CAPTURE, SETTLE_SIM_SECONDS } from '../visual/previewServer.mjs';
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
 * Godot's `--fixed-fps`, which replaces `get_process_delta_time()` with a
 * constant and skips `add_frame_delay` (`main/main.cpp:1902,4830,5071`).
 *
 * The settle contract puts the shutter at the scene's load instant, and the
 * pause-before-instantiate keeps it there for anything driven by
 * NOTIFICATION_*_PROCESS. NOTIFICATION_DRAW is NOT pause-gated, though, so a
 * node that catches up at first draw still reads one process delta — and
 * without this flag that delta is wall clock, i.e. how long this host took to
 * reach the first frame. `CPUParticles2D::_update_internal` is the measured
 * case: past the authored `preprocess` it advances by `delta`, quantized to
 * whole `1/fixed_fps` steps when the emitter sets one. A host slow enough to
 * cross that threshold jumps the reference a full step, silently, and only
 * sometimes — a reference image that is reproducible here and different there.
 *
 * 1000 puts the constant delta at 1 ms: below `1/fixed_fps` for any emitter
 * that does not ask for four-figure rates, so the quantized branch floors to
 * zero steps, and negligible in the unquantized one. Higher is not better —
 * the point is a delta small enough to round away, not a large frame count.
 *
 * This pins the reference to its own host, and nothing else: it changes what
 * Godot BELIEVES elapsed, never how many frames run or what is drawn.
 */
export const REFERENCE_FIXED_FPS = 1000;

/**
 * How many seconds of particle simulation `--particles` advances by, when the
 * caller does not say. ZERO, i.e. the reference keeps drawing the pose it draws
 * today unless someone asks for another one.
 *
 * Off by default even though this is the EDITOR-mirroring harness, and the two
 * other editor behaviours (`--no-previews`) are on by default. The asymmetry is
 * the point:
 *
 *  - The preview sun has ONE value Godot itself defines
 *    (`_load_default_preview_settings`), so defaulting to it copies the engine.
 *    A particle instant has no such value. The editor runs the emitter on wall
 *    clock — `set_process_internal(emitting)` at `cpu_particles_2d.cpp:1262` has
 *    no `is_editor_hint` guard — so "what the editor shows" is a different
 *    picture every frame and cannot be a default.
 *  - Any derived default (`preprocess`, else one lifetime) would be OUR
 *    previewer's convention written into the reference, which is the one thing
 *    a reference must never carry: it would then agree with us by construction.
 *  - A non-zero default would silently move every reference image already
 *    arbitrated against this harness.
 *
 * So the caller names the instant, in seconds, and the fixture header and the
 * comparison sheet record the number they named. Godot executes it through its
 * OWN loop — see `_advance_particles` in the bootstrap.
 *
 * ADDS to an authored `preprocess` rather than replacing it: `_update_internal`
 * seeds `todo` from the request and then adds `pre_process_time` on top when
 * `time == 0` (`cpu_particles_2d.cpp:727-731`). So `--particles 2` on an emitter
 * that writes `preprocess = 1.5` settles at 3.5 s, and the flag is "further",
 * not "at". An emitter with no `preprocess` — the case this exists for — has
 * nothing to add, so there the two readings coincide.
 *
 * SCENE-WIDE, deliberately: one number reaches every emitter. The previewer's
 * substituted window is PER EMITTER (one `lifetime` each), so a scene whose
 * emitters carry different lifetimes settles to several instants at once and no
 * single value here addresses it. Such a scene is not arbitrable through this
 * flag; arbitrate the behaviour on a fixture holding one instant instead of
 * picking a value and calling the residual a measurement.
 */
export const PARTICLES_PROCESS_DEFAULT = 0;

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

/**
 * The render modes, and what `--mode` accepts. `2d-root` is APPENDED rather
 * than slotted next to `2d`, so the rejection message keeps reading
 * `auto|2d|3d|…` with the historical prefix intact.
 */
export const RENDER_MODES = ['auto', '2d', '3d', '2d-root'];

/**
 * Driver -> the rendering method that offers it (main.cpp:2547-2565). Swapping
 * drivers is how a channel whose value x 255 is fractional is told apart from a
 * parity defect: the blend's tie-break is implementation-defined, so a one-step
 * gap that moves with the driver has no expected value to port. Linux builds
 * ship vulkan and the GLES3 trio; `d3d12`/`metal` are here because the table is
 * the engine's, and are rejected later by the engine itself, not by us.
 */
export const DRIVER_NAMES = ['vulkan', 'd3d12', 'metal', 'opengl3', 'opengl3_angle', 'opengl3_es'];

export const RENDERING_DRIVERS = {
  vulkan: 'forward_plus',
  d3d12: 'forward_plus',
  metal: 'forward_plus',
  opengl3: 'gl_compatibility',
  opengl3_angle: 'gl_compatibility',
  opengl3_es: 'gl_compatibility',
};

/** The mode whose capture IS the root window rather than a nested viewport. */
const ROOT_WINDOW_MODE = '2d-root';

/**
 * The viewport settings Godot applies to `SceneTree`'s root `Window` AND TO
 * NOTHING ELSE, each with the class default a `Viewport` keeps when nobody
 * hands it the project's value.
 *
 * `main/main.cpp`'s block runs only for a real game (`if (!editor &&
 * !project_manager)`, main/main.cpp:4521) and reaches `sml->get_root()`; the
 * `SceneTree` constructor's block writes straight to `root`. Neither walks any
 * other viewport, and `Viewport` has no inheritance path for these — so a
 * scene composed inside a `SubViewport` draws under the class default whatever
 * the project says, and the default 2D capture cannot observe the setting at
 * all. That is what `2d-root` exists for.
 *
 * Confined to what can change a 2D picture. The root-only settings that only a
 * 3D render could show (`msaa_3d`, TAA, debanding, occlusion culling, mesh LOD,
 * the shadow atlas, VRS) are already observed, because the 3D path renders
 * into the root window's own viewport and never nests anything.
 *
 * `property` is the SCRIPT-side name from `scene/main/viewport.cpp`'s
 * `ADD_PROPERTY` block — several differ from both the setter and the C++ field
 * (`oversampling` for `set_use_oversampling`, `transparent_bg` for
 * `set_transparent_background`), and a name Godot does not expose reads back
 * null on both viewports, which would compare equal and report agreement. The
 * generated script therefore proves each name exists before comparing.
 */
export const ROOT_ONLY_VIEWPORT_PROPERTIES = [
  {
    property: 'gui_snap_controls_to_pixels',
    setting: 'gui/common/snap_controls_to_pixels',
    appliedAt: 'main/main.cpp:4577-4578',
    defaultAt: 'scene/main/viewport.h:267',
  },
  {
    property: 'oversampling',
    setting: 'gui/fonts/dynamic_fonts/use_oversampling',
    appliedAt: 'main/main.cpp:4583-4584',
    defaultAt: 'scene/main/viewport.h:244',
  },
  {
    property: 'canvas_item_default_texture_filter',
    setting: 'rendering/textures/canvas_textures/default_texture_filter',
    appliedAt: 'main/main.cpp:4586-4589',
    defaultAt: 'scene/main/viewport.h:419',
  },
  {
    property: 'canvas_item_default_texture_repeat',
    setting: 'rendering/textures/canvas_textures/default_texture_repeat',
    appliedAt: 'main/main.cpp:4587-4591',
    defaultAt: 'scene/main/viewport.h:420',
  },
  {
    property: 'snap_2d_transforms_to_pixel',
    setting: 'rendering/2d/snap/snap_2d_transforms_to_pixel',
    appliedAt: 'scene/main/scene_tree.cpp:2106-2107',
    defaultAt: 'scene/main/viewport.h:268',
  },
  {
    property: 'snap_2d_vertices_to_pixel',
    setting: 'rendering/2d/snap/snap_2d_vertices_to_pixel',
    appliedAt: 'scene/main/scene_tree.cpp:2109-2110',
    defaultAt: 'scene/main/viewport.h:269',
  },
  {
    property: 'msaa_2d',
    setting: 'rendering/anti_aliasing/quality/msaa_2d',
    appliedAt: 'scene/main/scene_tree.cpp:2079-2080',
    defaultAt: 'scene/main/viewport.h:309',
  },
  {
    property: 'transparent_bg',
    setting: 'rendering/viewport/transparent_background',
    appliedAt: 'scene/main/scene_tree.cpp:2085-2086',
    defaultAt: 'scene/main/viewport.h:264',
  },
  {
    property: 'use_hdr_2d',
    setting: 'rendering/viewport/hdr_2d',
    appliedAt: 'scene/main/scene_tree.cpp:2088-2089',
    defaultAt: 'scene/main/viewport.h:265',
  },
  {
    property: 'sdf_oversize',
    setting: 'rendering/2d/sdf/oversize',
    appliedAt: 'scene/main/scene_tree.cpp:2145-2146',
    defaultAt: 'scene/main/viewport.h:331',
  },
  {
    property: 'sdf_scale',
    setting: 'rendering/2d/sdf/scale',
    appliedAt: 'scene/main/scene_tree.cpp:2147-2148',
    defaultAt: 'scene/main/viewport.h:332',
  },
];

/**
 * The refusal. Turns the bootstrap's drift report into the message the harness
 * throws instead of returning the SubViewport's answer.
 *
 * A measurement that cannot observe what was asked has to SAY SO — returning
 * the class default is a confident wrong number, and every 2D parity reading
 * this repo has taken went through that nested capture. There is no flag to
 * silence this, because the remedy answers the question correctly rather than
 * suppressing it.
 *
 * `null` when there is nothing to report, so a clean run costs nothing.
 */
export function rootOnlyDriftMessage(report) {
  if (!report) return null;
  const drift = report.drift ?? [];
  const missing = report.missing ?? [];
  if (drift.length === 0 && missing.length === 0) return null;

  const cite = (property) => ROOT_ONLY_VIEWPORT_PROPERTIES.find((e) => e.property === property);
  const named = drift.map(({ property }) => cite(property)?.setting ?? property);

  // The FIRST LINE carries the settings and the remedy, because the batch
  // capture tools log `error.message.split('\n')[0]` and nothing else: a
  // summary that says only "something could not be observed" reaches those logs
  // as a dead end.
  const lines = [
    named.length > 0
      ? `Refusing to answer: this 2D capture nests the scene in a SubViewport, so ` +
        `${named.join(', ')} cannot reach it — re-run with --mode 2d-root, which draws the ` +
        'same rectangle AS the root window.'
      : 'Refusing to answer: this 2D capture could not check the root-window-only viewport ' +
        `settings at all — ${missing.join(', ')} are not exposed under those names.`,
  ];

  for (const { property, root, nested } of drift) {
    const entry = cite(property);
    lines.push(
      `  ${entry?.setting ?? property} — root window ${root}, this capture ${nested} ` +
        `(Viewport.${property}; applied at ${entry?.appliedAt ?? '?'}, and a Viewport keeps ` +
        `its class default at ${entry?.defaultAt ?? '?'})`
    );
  }

  if (missing.length > 0) {
    lines.push(
      'The engine does not expose these under the names this harness asked for, so nothing ' +
        `was compared for them: ${missing.join(', ')}. Re-derive them from the ADD_PROPERTY ` +
        'block in scene/main/viewport.cpp.'
    );
  }

  return lines.join('\n');
}

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

/** Like `positiveNumber`, but 0 is a meaningful value rather than a mistake. */
function nonNegativeNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${flag} needs a non-negative number, got "${raw}"`);
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

/** Enum-flag validation, shared so a new flag does not invent a fourth wording. */
function oneOf(flag, allowed, raw) {
  const value = String(raw).toLowerCase();
  if (!allowed.includes(value)) {
    throw new Error(`${flag} takes one of ${allowed.join('|')}, got "${value}"`);
  }
  return value;
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
    sceneCameraPath: null,
    // 2D or 3D is a property of the SCENE, not of the invocation, so the
    // engine itself decides by default (`_is_canvas_scene`) — a JS copy of
    // Godot's class hierarchy would be one more pair of constants to keep in
    // sync, and this one cannot be checked by looking at the picture.
    mode: 'auto',
    camera: null,
    lookAt: null,
    probes: [],
    patch: 1,
    particles: PARTICLES_PROCESS_DEFAULT,
    // null = whatever the engine picks, so the default reference is never
    // pinned to one rasterizer.
    renderingDriver: null,
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
        // Optional node path: a scene may hold several Camera3Ds and "the first
        // one in tree order" is not a choice anyone made. Naming it is how both
        // harnesses provably look through the SAME camera.
        if (argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
          args.sceneCameraPath = argv[++i];
        }
        break;
      case '--mode':
        args.mode = oneOf('--mode', RENDER_MODES, argv[++i]);
        break;
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
      case '--particles':
        args.particles = nonNegativeNumber('--particles', argv[++i]);
        break;
      case '--rendering-driver':
        args.renderingDriver = oneOf('--rendering-driver', DRIVER_NAMES, argv[++i]);
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

export function projectConfig(sourceIni, { width, height, pinWindowToViewport = false }) {
  const drop = [
    /^environment\/defaults\/default_environment\s*=/,
    /^rendering\/environment\/defaults\/default_environment\s*=/,
    /^window\/size\/viewport_width\s*=/,
    /^window\/size\/viewport_height\s*=/,
    /^run\/main_scene\s*=/,
    /^config_version\s*=/,
  ];

  // Only when the capture IS the window. A window sized by an override — or by
  // a fullscreen `window/size/mode` — makes the stretch transform scale the
  // whole picture, so the root-window arm would draw a rectangle the previewer
  // never draws. Scoped to that arm rather than added to the list above,
  // because a blanket drop would silently move every 3D reference already
  // arbitrated through this harness.
  if (pinWindowToViewport) {
    drop.push(
      /^window\/size\/window_width_override\s*=/,
      /^window\/size\/window_height_override\s*=/,
      /^window\/size\/mode\s*=/
    );
  }

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
 * A single pixel is not a safe sample across two renderers: our 3D canvas
 * multisamples while these references render MSAA-off, so one pixel near an
 * edge, a silhouette or a shadow boundary carries a blend weight that exists
 * on one side only. (Our 2D canvas does not — it matches the engine's own
 * `msaa_2d = Disabled`, `scene/main/viewport.h:309`.) The median (not the
 * mean) also discards a stray outlier outright instead of averaging it in.
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
 *
 * `simSeconds` is the shared settle contract (`SETTLE_SIM_SECONDS`), i.e. how
 * far the scene's own clock has run when the shutter opens. It is a parameter
 * only so a test can drive the refusal below; the single definition is the
 * default. Both sides refuse a non-zero value, because neither can honour one
 * yet and each would otherwise sample a different instant — see the constant's
 * own doc. It governs the EDITOR-preview path; `--no-previews` deliberately
 * renders a live runtime, where "the authored instant" is not the question.
 */
export function bootstrapScript({
  scenePath,
  previews,
  simSeconds = SETTLE_SIM_SECONDS,
  camera,
  lookAt,
  frame,
  sceneCamera,
  sceneCameraPath,
  mode,
  out,
  boundsOut,
  modeOut,
  driftOut = null,
  fov,
  fovExplicit,
  canvas2DSize,
  particles = PARTICLES_PROCESS_DEFAULT,
}) {
  if (simSeconds !== 0) {
    throw new Error(
      `settle contract asks for ${simSeconds}s of simulated time, and this harness cannot ` +
        'reach it as a WHOLE-SCENE quantity: the tree is paused before the scene is ever ' +
        'instantiated, so no simulated time accrues at all, and unpausing to accrue it ' +
        'would also fall every body and advance every animation past the authored pose. ' +
        'The previewer has no driveable elapsed-time hook to meet a scene-wide instant at ' +
        'either, so the pair would not be comparable even then. Simulated time is ' +
        'therefore advanced PER SUBSYSTEM, through whatever fixed-step API Godot itself ' +
        'exposes for it, so the instant is named in that subsystem\'s own units: an ' +
        "emitter's `preprocess` is one such advance and is serialised in the file; " +
        '`--particles <seconds>` is the same advance asked for from outside.'
    );
  }
  const rootWindow = mode === ROOT_WINDOW_MODE;
  return `extends Node3D

const SCENE_PATH := ${gdString(scenePath)}
const PREVIEWS := ${previews ? 'true' : 'false'}
const OUT := ${gdString(out)}
const BOUNDS_OUT := ${gdString(boundsOut ?? '')}
const MODE_OUT := ${gdString(modeOut)}
# Empty on the root-window arm: there is nothing nested there to compare the
# root window against, so a report would be the capture measured against itself.
const DRIFT_OUT := ${gdString(rootWindow ? '' : (driftOut ?? ''))}
const ROOT_WINDOW := ${rootWindow ? 'true' : 'false'}
const ROOT_ONLY_PROPERTIES := [
${ROOT_ONLY_VIEWPORT_PROPERTIES.map(({ property }) => `\t"${property}",`).join('\n')}
]
const MODE := "${mode}"
const SCENE_CAMERA := ${sceneCamera ? 'true' : 'false'}
const SCENE_CAMERA_PATH := ${gdString(sceneCameraPath ?? '')}
const FOV := ${fov}
const PARTICLES_PROCESS := ${particles}
const CANVAS_2D_SIZE := Vector2i(${canvas2DSize.width}, ${canvas2DSize.height})
const CLEAR_2D := ${gdColor(CANVAS_2D_CAPTURE.clearColor)}

# Set by a refusal inside the render, so the ONE quit() below carries a non-zero
# exit code. A mid-walk quit() would be reset to 0 by that same call.
var _refused := false

func _ready() -> void:
	# This is where the settle contract is honoured. SETTLE_SIM_SECONDS is 0, and
	# pausing BEFORE the scene is instantiated is how the reference advances
	# exactly that much of the scene's own clock — the same instant the previewer
	# captures at. Nothing later can put simulated time back, so it has to be
	# first; the generator refuses any other value outright rather than emit a
	# pause that no longer means what this comment says.
	#
	# Pausing also deactivates the physics servers, so no body is ever stepped
	# and no state callback ever fires. Set here, not after add_child(), because
	# entering the tree is itself enough to schedule the first step. See
	# _freeze_game_logic() for why this is the catch-all.
	#
	# Gated on PREVIEWS, which is what selects between the harness's two jobs:
	# the default mirrors the Node3D EDITOR, which never runs game logic, so the
	# authored pose is the whole point. --no-previews asks for true RUNTIME
	# semantics, and a runtime that never steps physics is not a runtime — a
	# body is supposed to fall there.
	if PREVIEWS:
		get_tree().paused = true
	var target: Node = load(SCENE_PATH).instantiate()
	var two_d := MODE == "2d" or MODE == "${ROOT_WINDOW_MODE}" or (MODE == "auto" and _is_canvas_scene(target))
	# Written before the render, so a run that dies mid-frame still says which
	# path it took — the caller pairs our image with the previewer's on it. Both
	# 2D arms draw the SAME rectangle and so report the same "2d": which viewport
	# composed it is the harness's business, not the pairing's.
	_write_mode(two_d)
	if two_d:
		if ROOT_WINDOW:
			await _render_2d_root(target)
		else:
			await _render_2d(target)
	else:
		await _render_3d(target)
	get_tree().quit(1 if _refused else 0)

# Godot's CanvasItemEditor claims a CanvasItem root, which is the rule
# workspaceForScene.ts mirrors — plus CanvasLayer, which is a plain Node that
# exists only to host CanvasItems, and which the previewer counts as 2D too.
func _is_canvas_scene(target: Node) -> bool:
	return target is CanvasItem or target is CanvasLayer

func _render_3d(target: Node) -> void:
	add_child(target)
	_advance_particles(target)
	if PREVIEWS:
		_freeze_game_logic(target)
		_apply_preview_lighting(target)
	# A refusal must not reach _place_camera: rendering nothing is the whole point.
	if not _build_csg(target):
		return
	_place_camera(target)
	await _converge()
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
	_report_root_only_drift(vp)
	if not SCENE_CAMERA:
		_disable_2d_cameras(target)
	vp.add_child(target)
	_advance_particles(target)
	if PREVIEWS:
		_freeze_game_logic(target)
	await _converge()
	vp.get_texture().get_image().save_png(OUT)

# THE SECOND 2D ARM. Godot hands several viewport settings to SceneTree's root
# Window and to nothing else, so nothing composed inside a SubViewport can
# observe them and _render_2d's picture is the class default's, not the
# project's. This one makes the scene the root window's OWN scene — the same
# add_child SceneTree performs for a project's main scene
# (scene/main/scene_tree.cpp:1738-1739) — so the values in force are the ones
# the project set.
#
# The rectangle is unchanged: the generated project.godot pins the window to
# the project viewport size for this arm, so both arms capture the same frame
# and a probe coordinate means the same thing in each. That pinning is also why
# _render_2d stays the DEFAULT — it owns its rectangle outright, with no window
# manager, screen size or override able to reach it, which is what makes the
# capture reproducible under xvfb. This arm's caller checks the written image
# is exactly that rect rather than trusting the window to have obeyed.
func _render_2d_root(target: Node) -> void:
	RenderingServer.set_default_clear_color(CLEAR_2D)
	if not SCENE_CAMERA:
		_disable_2d_cameras(target)
	# One frame first: _ready runs while the root window is still adding THIS
	# node, and a second add_child on a parent in that state is rejected outright
	# (scene/main/node.cpp:1709) — which renders an empty window rather than
	# failing. Yielding, rather than deferring the call, is what keeps the
	# particle request below adjacent to the subtree entering the tree.
	await get_tree().process_frame
	get_tree().root.add_child(target)
	_advance_particles(target)
	if PREVIEWS:
		_freeze_game_logic(target)
	await _converge()
	get_tree().root.get_texture().get_image().save_png(OUT)

# What the nested capture CANNOT answer, reported rather than guessed at.
#
# Reads both viewports' LIVE values instead of re-deriving Godot's per-property
# defaults here: the root window has already been handed the project's values by
# the time _ready runs, and the fresh SubViewport has whatever Viewport's own
# constructor gave it. Comparing the two needs no copy of either table and stays
# correct if a future engine starts propagating one of these.
#
# Every name is proved to exist on BOTH viewports first. Object.get() returns
# null for a name the engine does not expose, and two nulls compare equal — so a
# stale name would report agreement, which is the exact silence this exists to
# end.
func _report_root_only_drift(vp: Viewport) -> void:
	if DRIFT_OUT == "":
		return
	var root := get_tree().root
	var drift: Array = []
	var missing: Array = []
	for property: String in ROOT_ONLY_PROPERTIES:
		if not _has_property(root, property) or not _has_property(vp, property):
			missing.append(property)
			continue
		var root_value: Variant = root.get(property)
		var nested_value: Variant = vp.get(property)
		if root_value != nested_value:
			drift.append({
				"property": property,
				"root": var_to_str(root_value),
				"nested": var_to_str(nested_value),
			})
	if drift.is_empty() and missing.is_empty():
		return
	var file := FileAccess.open(DRIFT_OUT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({"drift": drift, "missing": missing}))
	file.close()

func _has_property(object: Object, property: String) -> bool:
	for info: Dictionary in object.get_property_list():
		if info["name"] == property:
			return true
	return false

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

# The reference must show the AUTHORED pose, not a running game. The frames
# _converge() steps would otherwise let physics FALL a body and autoplay /
# AnimationTree clips ADVANCE past their rest pose — i.e. carry the scene past
# the instant the settle contract names. The Node3DEditor preview our previewer
# mirrors never runs game logic, so we stop it before converging.
#
# The catch-all is SceneTree.paused, set before the scene is ever instantiated:
# SceneTree::set_pause() calls PhysicsServer3D/2D::set_active(false), so the
# servers never step and never fire a state callback. That covers every physics
# node at once — including ones that move something OTHER than themselves, which
# a per-type freeze cannot. VehicleBody3D is the case that proved it: freezing
# the body left it in place, but VehicleBody3D::_body_state_changed() still ran
# and repositioned its VehicleWheel3D children to
# hardPoint + wheelDirection * suspensionLength, dropping every wheel by the
# suspension rest length. Pausing removes the callback that did it.
#
# The per-type calls below remain for the non-physics drivers pause does not
# reach — an AnimationPlayer's queued autoplay, an AnimationTree's graph — and
# for SoftBody3D, whose integration the pause covers but whose disabled
# process_mode also pins it if a future Godot changes that. GPUParticles are
# left alone: their preprocessed burst is the authored look, not running logic.
#
# Both halves — this walk and the pause — are gated on PREVIEWS together, so
# "editor" and "runtime" stay two whole answers rather than a mixture. Stopping
# an AnimationPlayer in a render that is meant to show the running game is the
# same mistake as pausing its physics.
func _freeze_game_logic(node: Node) -> void:
	if node is AnimationPlayer:
		(node as AnimationPlayer).stop()
	if node is AnimationTree:
		(node as AnimationTree).active = false
	if node is SoftBody3D:
		(node as SoftBody3D).process_mode = Node.PROCESS_MODE_DISABLED
	for child in node.get_children():
		_freeze_game_logic(child)

# EDITOR-MODE PARTICLES. The pause above stops game logic, which is what the
# Node3D editor does — except for one thing it does NOT do: particles keep
# running there. CPUParticles2D::_notification's ENTER_TREE arm is a bare
# set_process_internal(emitting) (cpu_particles_2d.cpp:1262) with no
# is_editor_hint guard, so an emitter animates while you look at the scene, and
# a reference that draws a paused frame 0 draws a pose nobody in the editor
# sees. Only INTERNAL_PROCESS is pause-gated, though — NOTIFICATION_DRAW is not,
# and its "if (emitting && time == 0)" arm calls _update_internal() exactly once,
# at first draw (:1279-1282). That single call is the seam this uses.
#
# request_particles_process() is Godot's own API for "advance this emitter by N
# seconds inside one frame" (cpu_particles_2d.cpp:630, and the identical
# CPUParticles3D::request_particles_process). _update_internal picks the request
# up as todo, ADDS any authored pre_process_time on top (:727-731), and spends
# the sum through the SAME loop preprocess alone would use —
# while (todo > 0) { _particles_process(frame_time); todo -= frame_time; }
# (:733-736) — at the emitter's own frame_time, with speed_scale forced to 1 and
# the last step overshooting rather than being shortened. So the instant this
# reaches is defined entirely by the engine; the harness contributes only the
# number of seconds, and the caller names that.
#
# Asked for BEFORE any frame runs, because _update_internal zeroes
# _requested_process_time on the way past: it is a one-shot request, not a rate.
# Not gated on PREVIEWS — the pause is what makes it a single deterministic
# advance, but a caller who asks for N seconds of --no-previews runtime means
# the same N seconds.
#
# CPUParticles only. GPUParticles2D/3D carry the same method, but the previewer
# draws a GPUParticles node as a bare transform group (ADR-0008), so there is no
# pose on our side for an advanced one to be measured against.
func _advance_particles(node: Node) -> void:
	if PARTICLES_PROCESS <= 0.0:
		return
	if node is CPUParticles2D:
		(node as CPUParticles2D).request_particles_process(PARTICLES_PROCESS)
	elif node is CPUParticles3D:
		(node as CPUParticles3D).request_particles_process(PARTICLES_PROCESS)
	for child in node.get_children():
		_advance_particles(child)

# CONVERGENCE, not the settle contract — do not "align" this count with
# anything on the previewer side. These frames exist so the picture stops
# moving: an import lands, the first draw completes, shaped text finally
# measures. They carry no simulated time, because the tree is paused before the
# scene exists, so no number of them moves the instant being captured. Our side
# reaches the same standstill by a different route (screenshots until two are
# byte-identical) and that asymmetry is correct — a stopping test has no
# semantics to share.
func _converge() -> void:
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

# The scene's world-space AABB — a true read of the FINAL scene bounds, but
# NOT necessarily the number that placed --frame's camera: this runs AFTER
# _converge() (six process frames + frame_post_draw), while _place_camera runs
# synchronously right after add_child(), before any frame has settled. For a
# scene holding a Label3D the two calls can disagree, because a fresh
# Label3D's shaped-text AABB is not available synchronously on add_child()
# despite NOTIFICATION_ENTER_TREE requesting an update — measured on
# unit-torus-mesh.tscn: pre-settle _scene_bounds() returns [3,4,3] (each
# Label3D contributing only its bare position, no extent); this
# post-settle call returns [4.938,7.445,4.938] once the labels have actually
# shaped. Rendering the pre-settle box's derived camera reproduces --frame's
# own picture pixel-for-pixel; this (later, larger) box's camera does not.
# nodes/3d/label3d/Component.tsx's own doc has the full citation — do not
# move this call earlier to "fix" the mismatch, since that would change what
# --emit-bounds reports for every OTHER scene too.
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

# modules/csg/csg_shape.cpp:222,507: node_aabb is written only by the DEFERRED
# update_shape, so before the first frame every CSG node reports an empty box
# and _place_camera frames the union of their ORIGINS instead of their solids.
# False is a refusal: the caller must render nothing.
func _build_csg(node: Node) -> bool:
	# csg_shape.cpp:470,507 — _get_brush() recurses into every visible child and
	# writes its node_aabb, so the ROOT's build is what fills a contributor's box;
	# update_shape() returns immediately off the root (:568-570).
	if node is CSGShape3D and (node as CSGShape3D).is_root_shape():
		# Bound behind DISABLE_DEPRECATED; refuse rather than render a camera placed
		# from empty AABBs, which looks like an ordinary reference picture.
		if not node.has_method("_update_shape"):
			push_error("CSGShape3D._update_shape is unavailable; cannot build CSG before the camera")
			_refused = true
			return false
		node.call("_update_shape")
	for child in node.get_children():
		if not _build_csg(child):
			return false
	return true

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
		# Claim the viewport explicitly. A scene can hold several Camera3Ds — the
		# town carries a PreviewCamera plus one inside every instanced vehicle —
		# and which of them ends up current otherwise depends on tree order and
		# on whatever the running game did, which is exactly the ambient state
		# this harness pauses away. Without this the capture silently framed a
		# different camera once physics stopped.
		existing.make_current()
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
	if SCENE_CAMERA_PATH != "":
		# The previewer addresses nodes from the scene ROOT inclusive
		# ("TownScene/PreviewCamera"); from the root node itself that first
		# segment is the node we are already standing on, so try both spellings
		# rather than making the caller know which side it is talking to.
		var named := node.get_node_or_null(NodePath(SCENE_CAMERA_PATH)) as Camera3D
		if named == null:
			var slash := SCENE_CAMERA_PATH.find("/")
			if slash != -1:
				named = node.get_node_or_null(NodePath(SCENE_CAMERA_PATH.substr(slash + 1))) as Camera3D
		if named != null:
			return named
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

/**
 * The render pass's argv. Split out so the flag set is assertable without an
 * engine: dropping `--fixed-fps` costs nothing visible here and everything
 * later, since the reference keeps rendering — just against this host's frame
 * timing instead of a constant.
 */
export function renderArgv(work, { renderingDriver = null } = {}) {
  const argv = ['--path', work, '--fixed-fps', String(REFERENCE_FIXED_FPS), '--quit-after', '400'];
  // main.cpp:2582 aborts on a driver its method does not offer, so the pair
  // travels together — naming the driver alone would abort under the default
  // `forward_plus`.
  if (renderingDriver) {
    argv.push(
      '--rendering-driver',
      renderingDriver,
      '--rendering-method',
      RENDERING_DRIVERS[renderingDriver]
    );
  }
  return argv;
}

/** Seconds a single engine pass may run before the harness reaps it. */
export const ENGINE_TIMEOUT_S = 300;
/** Seconds between the group's SIGTERM and its SIGKILL. */
export const ENGINE_KILL_AFTER_S = 10;
/**
 * `spawnSync`'s own timer, strictly longer than the group killer's whole
 * budget so it can only ever fire as a backstop — never in place of it.
 */
export const SPAWN_BACKSTOP_MS = (ENGINE_TIMEOUT_S + ENGINE_KILL_AFTER_S + 30) * 1000;

/**
 * Builds the argv for one engine pass. Split out from the spawn so the reaping
 * contract is assertable without an engine, an X server, or a 300-second wait.
 *
 * Every pass goes through `timeout(1)` rather than relying on `spawnSync`'s
 * timer alone. Under a display the direct child is `xvfb-run`, a WRAPPER:
 * `spawnSync` signals that wrapper, and the `godot` it launched survives,
 * reparents to init and keeps rendering forever — as does the `Xvfb` whose
 * display lock then blocks the number for every later run. `timeout` puts the
 * command in its own process group and signals the GROUP on expiry (coreutils
 * `timeout.c` calls `setpgid` unless `--foreground`), so the engine dies with
 * its wrapper. `-k` follows with SIGKILL for an engine ignoring SIGTERM.
 *
 * `screen` sizes the virtual X screen for this run. Only the root-window arm
 * passes one: its capture IS the window, so a project viewport larger than
 * xvfb-run's own default screen would leave the window clipped to the screen
 * and the image the wrong size. Left unset everywhere else, since changing the
 * screen under a render that does not depend on it is one more variable in a
 * reference nobody asked to move.
 */
export function godotSpawnPlan(args, { display, screen = null, groupTimeout = true }) {
  const screenArgs = screen ? ['-s', `-screen 0 ${screen.width}x${screen.height}x24`] : [];
  const engine = display ? ['xvfb-run', '-a', ...screenArgs, 'godot', ...args] : ['godot', ...args];
  const argv = groupTimeout
    ? ['timeout', '-k', String(ENGINE_KILL_AFTER_S), String(ENGINE_TIMEOUT_S), ...engine]
    : engine;
  return { command: argv[0], argv: argv.slice(1), timeoutMs: SPAWN_BACKSTOP_MS };
}

/** `timeout(1)`'s expiry codes: 124 on SIGTERM, 137 once it escalates. */
const TIMEOUT_EXIT_CODES = new Set([124, 137]);

/** Memoised so the probe costs one spawn per process, not one per pass. */
let groupTimeoutAvailable = null;
function hasGroupTimeout() {
  if (groupTimeoutAvailable === null) {
    groupTimeoutAvailable =
      spawnSync('timeout', ['--version'], { encoding: 'utf8' }).status === 0;
  }
  return groupTimeoutAvailable;
}

function runGodot(args, { display, screen = null }) {
  const plan = godotSpawnPlan(args, { display, screen, groupTimeout: hasGroupTimeout() });
  const result = spawnSync(plan.command, plan.argv, {
    encoding: 'utf8',
    timeout: plan.timeoutMs,
  });
  // `error` carries a spawn failure (ENOENT when godot/xvfb-run is missing, or
  // the backstop firing) that `status` alone (null in that case) does not —
  // callers surface it. `timedOut` names the group killer's own expiry, which
  // reports as an ordinary non-zero exit and would otherwise read as an engine
  // crash.
  return {
    status: result.status,
    error: result.error ?? null,
    timedOut: TIMEOUT_EXIT_CODES.has(result.status),
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
  particles = PARTICLES_PROCESS_DEFAULT,
  renderingDriver = null,
  keepWork = false,
}) {
  const scenePath = resolve(scene);
  if (!existsSync(scenePath)) throw new Error(`No such scene: ${scenePath}`);
  if (!RENDER_MODES.includes(mode)) {
    throw new Error(`mode must be one of ${RENDER_MODES.join('|')}, got "${mode}"`);
  }
  if (renderingDriver !== null && !DRIVER_NAMES.includes(renderingDriver)) {
    throw new Error(
      `renderingDriver must be one of ${DRIVER_NAMES.join('|')}, got "${renderingDriver}"`
    );
  }

  const root = resolveProjectRoot(scenePath);
  const work = await mkdtemp(join(tmpdir(), 'godot-ref-'));
  try {
    return await renderInto(work, { root, scenePath, out, width, height, previews, camera,
      lookAt, frame, sceneCamera, sceneCameraPath, mode, boundsOut, fov, fovExplicit, particles,
      renderingDriver });
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
    root, scenePath, out, width, height, previews, camera, lookAt, frame, sceneCamera, sceneCameraPath,
    mode, boundsOut, fov, fovExplicit, particles, renderingDriver,
  }
) {
  await cp(root, work, { recursive: true, dereference: true });
  // Inside the scratch project, not beside the image: the mode is how the
  // caller pairs this render with the previewer's, not an artefact to keep. The
  // drift report is the same kind of thing — read once, turned into a refusal.
  const modeOut = join(work, '__ref_mode.txt');
  const driftOut = join(work, '__ref_root_only.json');
  const rootWindow = mode === ROOT_WINDOW_MODE;

  const sourceIni = existsSync(join(root, 'project.godot'))
    ? await readFile(join(root, 'project.godot'), 'utf8')
    : null;
  const canvas2DSize = projectViewportSizeFromIni(sourceIni);
  // The root-window arm captures the window, so the window has to BE the
  // project-viewport rect; every other arm keeps the 3D frame override.
  await writeFile(
    join(work, 'project.godot'),
    projectConfig(
      sourceIni,
      rootWindow ? { ...canvas2DSize, pinWindowToViewport: true } : { width, height }
    )
  );

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
      driftOut,
      fov,
      particles,
      canvas2DSize,
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

  const render = runGodot(renderArgv(work, { renderingDriver }), {
    display: true,
    screen: rootWindow ? canvas2DSize : null,
  });
  if (!existsSync(resolve(out))) {
    // Surface the spawn error (missing godot/xvfb-run, the backstop firing)
    // that a bare "produced no image" would otherwise hide with empty stderr,
    // and name an expiry rather than letting its exit code read as a crash.
    const why = render.timedOut
      ? `\nThe engine did not finish within ${ENGINE_TIMEOUT_S}s and its process group was reaped.`
      : render.error
        ? `\n${render.error.message}`
        : '';
    throw new Error(
      `Godot produced no image for ${basename(scenePath)} (exit ${render.status}).${why}\n${render.stdout}\n${render.stderr}`
    );
  }
  const rendered = existsSync(modeOut) ? (await readFile(modeOut, 'utf8')).trim() : null;

  // Both refusals below delete the image first. Godot has already written one
  // by the time either is known, and the default out path lives in the repo and
  // is reused across runs — so a picture the harness will not vouch for would
  // outlive the message saying so, which is the same stale-answer trap the
  // pre-render delete above exists to close.
  const refuse = async (message) => {
    await rm(resolve(out), { force: true });
    throw new Error(message);
  };

  if (rootWindow) {
    // The window is asked for, not guaranteed: a window manager, a screen too
    // small, or a project setting nobody thought to drop can all hand back a
    // different rect, and a picture at the wrong size is a wrong measurement
    // that still looks like an answer.
    const png = PNG.sync.read(await readFile(resolve(out)));
    if (png.width !== canvas2DSize.width || png.height !== canvas2DSize.height) {
      await refuse(
        `--mode ${ROOT_WINDOW_MODE} captured a ${png.width}x${png.height} window, but the ` +
          `project viewport is ${canvas2DSize.width}x${canvas2DSize.height}. The two 2D arms ` +
          'must draw the same rectangle for a probe coordinate to mean the same thing in each.'
      );
    }
  }

  const drift = existsSync(driftOut)
    ? rootOnlyDriftMessage(JSON.parse(await readFile(driftOut, 'utf8')))
    : null;
  if (drift) await refuse(drift);

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
    console.error(
      `       [--mode ${ROOT_WINDOW_MODE}]  (same rectangle, rendered AS the root window, for the ` +
        'viewport settings Godot applies to the root and to nothing else)'
    );
    console.error(
      '       [--particles seconds]  (advances every CPUParticles emitter that much ' +
        'FURTHER through Godot\'s own settle loop, on top of any authored preprocess)'
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
