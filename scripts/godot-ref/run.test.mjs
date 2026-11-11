/**
 * Tests the setup that decides what the Godot reference harness asks the engine to draw, without
 * starting the engine. `run.engine.test.mjs` checks the picture. ADR-0025 rests on two decisions
 * here: the harness injects the editor-only preview sun and environment, and the generated project
 * carries no `default_environment`.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { degToRad } from '../../packages/textscene-core/src/godot/math/math.ts';
import { LAVAPIPE_LOADER_ENV } from './lavapipe.mjs';
import {
  CANVAS_2D_CAPTURE,
  CANVAS_CAPTURE,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  SHELL_CHROME,
} from '../visual/preview/appContract.mjs';
import {
  bootstrapScript,
  DEFAULT_RENDERING_METHOD,
  EDITOR_CAMERA_DIRECTION,
  EDITOR_CAMERA_DISTANCE,
  EDITOR_FOV,
  enginePassStalled,
  ENGINE_KILL_AFTER_S,
  ENGINE_TIMEOUT_S,
  FOG_HISTORY_MAX_CYCLES,
  FOG_JITTER_CYCLE_FRAMES,
  FRAME_MARGIN,
  godotSpawnPlan,
  importAssets,
  PARTICLES_PROCESS_DEFAULT,
  parseArgs,
  REFERENCE_FIXED_FPS,
  RENDER_QUIET_FRAMES,
  RENDER_QUIET_MSEC,
  RENDER_WAIT_MAX_FRAMES,
  NEVER_SETTLES_CAPTURE_FRAME,
  CONVERGENCE_FRAMES,
  renderArgv,
  renderingDeviceMessage,
  renderingMethodFallbackMessage,
  requestedRenderingMethod,
  SPAWN_BACKSTOP_MS,
  resolveProjectRoot,
  projectConfig,
  probePixels,
  ROOT_ONLY_VIEWPORT_PROPERTIES,
  rootOnlyDriftMessage,
  harnessWarnings,
} from './run.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

/** The generated bootstrap, with only the field under test spelled out. */
function bootstrap(overrides = {}) {
  return bootstrapScript({
    scenePath: 'res://x.tscn',
    previews: true,
    camera: null,
    lookAt: null,
    frame: false,
    sceneCamera: false,
    sceneCameraPath: null,
    mode: 'auto',
    out: '/tmp/o.png',
    boundsOut: null,
    modeOut: '/tmp/m.txt',
    driftOut: '/tmp/d.json',
    fov: 70,
    fovExplicit: false,
    canvas2DSize: { width: 640, height: 360 },
    ...overrides,
  });
}

/**
 * The harness runs under plain node, so it copies the previewer's editor-camera constants by
 * hand. Only this test pins the copies together: a one-sided edit makes `ref:godot` and `ref:ours`
 * frame different pictures while both appear to work, such as fov 75 against fov 70.
 */
describe('editor-camera constants mirror the previewer', () => {
  it('matches godotEditorCamera.ts', async () => {
    const { editorCameraDirection, editorCameraPosition, EDITOR_CAMERA_FOV } =
      await import('../../packages/textscene-core/src/r3f/godotEditorCamera.ts');
    const core = editorCameraDirection();
    expect(EDITOR_CAMERA_DIRECTION[0]).toBeCloseTo(core.x, 6);
    expect(EDITOR_CAMERA_DIRECTION[1]).toBeCloseTo(core.y, 6);
    expect(EDITOR_CAMERA_DIRECTION[2]).toBeCloseTo(core.z, 6);
    const position = editorCameraPosition();
    EDITOR_CAMERA_DIRECTION.forEach((component, axis) => {
      expect(position[axis]).toBeCloseTo(component * EDITOR_CAMERA_DISTANCE, 6);
    });
    expect(EDITOR_FOV).toBe(EDITOR_CAMERA_FOV);
  });

  it('matches frameSceneBounds.ts’s framing margin', async () => {
    const THREE = await import('three');
    const { frameSceneBounds } = await import('../../packages/textscene-core/src/r3f/frameSceneBounds.ts');
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)));
    const camera = new THREE.PerspectiveCamera(EDITOR_FOV);

    frameSceneBounds(scene, camera, null);

    const fitDistance = 1 / Math.tan(degToRad(EDITOR_FOV / 2));
    expect(camera.position.length()).toBeCloseTo(fitDistance * FRAME_MARGIN, 6);
  });

  /**
   * The 2D pair agrees on a rectangle instead of a camera: Godot's SubViewport and the
   * previewer's stage at zoom 1 have the same size. A Control's anchors resolve against the
   * frame, so a one-sided edit moves the content and the two images cannot be compared.
   */
  it('matches the default project viewport and viewport2d.ts’s fit preference', async () => {
    const { DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT } =
      await import('../../packages/textscene-core/src/parser/projectSettingsParser.ts');
    const { FIT_ON_OPEN_2D_STORAGE_KEY: coreKey } =
      await import('../../packages/textscene-core/src/r3f/components/Canvas2DStage/viewport2d.ts');
    expect(CANVAS_2D_CAPTURE.width).toBe(DEFAULT_VIEWPORT_WIDTH);
    expect(CANVAS_2D_CAPTURE.height).toBe(DEFAULT_VIEWPORT_HEIGHT);
    expect(FIT_ON_OPEN_2D_STORAGE_KEY).toBe(coreKey);
  });

  it('gives a 2D capture room for the frame at zoom 1', () => {
    // The stage is the browser viewport minus the shell's dock and top bar. A frame that does not
    // fit is clipped, and the capture picks up the shell's chrome at the edges.
    expect(CANVAS_2D_CAPTURE.viewport.width - SHELL_CHROME.width).toBeGreaterThanOrEqual(
      CANVAS_2D_CAPTURE.width
    );
    expect(CANVAS_2D_CAPTURE.viewport.height - SHELL_CHROME.height).toBeGreaterThanOrEqual(
      CANVAS_2D_CAPTURE.height
    );
  });
});

describe('projectConfig — an autoload is a script too', () => {
  const withAutoloads = [
    '[application]',
    'config/name="Tool"',
    '',
    '[autoload]',
    'ThemeManager="*res://common/autoloads/theme_manager.gd"',
    'WindowManager="*res://common/autoloads/window_manager.gd"',
    '',
    '[rendering]',
    'anti_aliasing/quality/msaa_3d=2',
  ].join('\n');

  /**
   * An autoload runs before the scene exists, so stripping the scene's scripts misses it.
   * protongraph's `ThemeManager._ready` assigns `get_tree().get_root().theme`, which themes
   * every widget while the scene file names no theme.
   */
  it('drops the autoloads when the scene is rendered as the editor shows it', () => {
    const ini = projectConfig(withAutoloads, { width: 400, height: 300, runScripts: false });
    expect(ini).not.toMatch(/theme_manager\.gd/);
    expect(ini).not.toMatch(/WindowManager/);
    // Everything else the project set still travels.
    expect(ini).toMatch(/anti_aliasing\/quality\/msaa_3d=2/);
    expect(ini).toMatch(/config\/name="Tool"/);
  });

  it('keeps them for a runtime render, which is a running game', () => {
    const ini = projectConfig(withAutoloads, { width: 400, height: 300, runScripts: true });
    expect(ini).toMatch(/theme_manager\.gd/);
  });
});

describe('bootstrapScript — the random generator is seeded', () => {
  /**
   * A GPUParticles3D without `use_fixed_seed` draws its seed from `Math::rand()` on entering the
   * tree (`gpu_particles_3d.cpp:438-439`), which Godot seeds from the clock. Two runs of one scene
   * then drew a different burst, 18% of the picture apart.
   */
  it('seeds the global generator before the scene loads', () => {
    const gd = bootstrap({ previews: true });
    expect(gd).toMatch(/\n\tseed\(\d+\)\n/);
    expect(gd.indexOf('\tseed(')).toBeLessThan(gd.indexOf('load(SCENE_PATH)'));
  });
});

describe('bootstrapScript — a non-tool script never runs under previews', () => {
  /**
   * Like the editor, the default pauses the tree first, stops AnimationPlayers, never steps
   * physics and runs no plain script's `_ready`, which could hide a node or overwrite a value
   * the `.tscn` describes. The editor runs `@tool` scripts, so the reference does too.
   */
  it('strips a non-tool script before the scene enters the tree', () => {
    const gd = bootstrap({ previews: true });
    expect(gd).toMatch(/_strip_runtime_scripts\(target\)/);
    // Before add_child, or `_ready` has already fired by the time it runs.
    expect(gd.indexOf('_strip_runtime_scripts(target)')).toBeLessThan(gd.indexOf('func _render_3d'));
    expect(gd).toMatch(/is_tool\(\)/);
  });

  it('leaves scripts alone under --no-previews, which asks for runtime semantics', () => {
    const gd = bootstrap({ previews: false });
    expect(gd).toMatch(/if PREVIEWS:\n\t\t_strip_runtime_scripts\(target\)/);
    expect(gd).toMatch(/const PREVIEWS := false/);
  });
});

describe('parseArgs', () => {
  it('takes the scene as the sole positional argument', () => {
    expect(parseArgs(['scenes/fixtures/unit-plane-mesh.tscn']).scene).toBe(
      'scenes/fixtures/unit-plane-mesh.tscn'
    );
  });

  it('defaults to the frame our own capture produces, and previews to on', () => {
    // A bare `ref:godot` and a bare `ref:ours` put a probe at (x, y) on the same surface point
    // only with the same pixels and the same aspect ratio.
    const args = parseArgs(['a.tscn']);
    expect(args.width).toBe(CANVAS_CAPTURE.width);
    expect(args.height).toBe(CANVAS_CAPTURE.height);
    expect(args.previews).toBe(true);
  });

  it('reads camera placement as two vec3 triples', () => {
    const args = parseArgs(['a.tscn', '--camera', '0,1.5,4', '--look-at', '0,1,0']);
    expect(args.camera).toEqual([0, 1.5, 4]);
    expect(args.lookAt).toEqual([0, 1, 0]);
  });

  it('collects repeated --probe flags in order', () => {
    const args = parseArgs(['a.tscn', '--probe', '10,20', '--probe', '30,40']);
    expect(args.probes).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it('turns the previews off with --no-previews, for runtime-semantics renders', () => {
    expect(parseArgs(['a.tscn', '--no-previews']).previews).toBe(false);
  });

  it('rejects a --camera without three components rather than rendering a wrong frame', () => {
    expect(() => parseArgs(['a.tscn', '--camera', '0,1'])).toThrow(/three/i);
  });

  it('leaves 2D-or-3D to the engine unless --mode says otherwise', () => {
    expect(parseArgs(['a.tscn']).mode).toBe('auto');
    expect(parseArgs(['a.tscn', '--mode', '2d']).mode).toBe('2d');
    expect(parseArgs(['a.tscn', '--mode', '3D']).mode).toBe('3d');
  });

  it('rejects an unknown --mode instead of falling back to a camera the scene has no use for', () => {
    expect(() => parseArgs(['a.tscn', '--mode', 'canvas'])).toThrow(/auto\|2d\|3d/);
  });

  it('takes 2d-root, the mode that renders the scene as the root window', () => {
    expect(parseArgs(['a.tscn', '--mode', '2d-root']).mode).toBe('2d-root');
    expect(parseArgs(['a.tscn', '--mode', '2D-ROOT']).mode).toBe('2d-root');
  });
});

describe('resolveProjectRoot', () => {
  it('finds the nearest ancestor holding a project.godot', () => {
    const scene = join(REPO_ROOT, 'scenes/demos/3d/graphics_settings/control.tscn');
    expect(resolveProjectRoot(scene)).toBe(join(REPO_ROOT, 'scenes/demos/3d/graphics_settings'));
  });

  it("falls back to the scene's own directory when no project.godot exists", () => {
    // scenes/fixtures has no project file, and its res:// paths are relative to itself.
    const scene = join(REPO_ROOT, 'scenes/fixtures/unit-plane-mesh.tscn');
    expect(resolveProjectRoot(scene)).toBe(join(REPO_ROOT, 'scenes/fixtures'));
  });

  it('does not escape past the repo into an unrelated ancestor project', () => {
    const scene = join(REPO_ROOT, 'scenes/fixtures/unit-plane-mesh.tscn');
    expect(resolveProjectRoot(scene).startsWith(join(REPO_ROOT, 'scenes'))).toBe(true);
  });
});

describe('projectConfig', () => {
  const withDefaultEnv = [
    '[application]',
    'config/name="Graphics Settings"',
    '',
    '[rendering]',
    'environment/defaults/default_environment="res://default_env.tres"',
    'anti_aliasing/quality/msaa_3d=2',
  ].join('\n');

  it('drops a default_environment the source project declares', () => {
    const ini = projectConfig(withDefaultEnv, { width: 400, height: 300 });
    expect(ini).not.toMatch(/default_environment/);
  });

  it('keeps the source project’s other rendering settings', () => {
    const ini = projectConfig(withDefaultEnv, { width: 400, height: 300 });
    expect(ini).toMatch(/anti_aliasing\/quality\/msaa_3d=2/);
  });

  it('imports on one thread, because the parallel font import deadlocks', () => {
    const ini = projectConfig(null, { width: 640, height: 480 });
    expect(ini).toMatch(/\[editor\]\s+import\/use_multiple_threads=false/);
  });

  it('overrides a source project that turns threaded import on', () => {
    const ini = projectConfig('[editor]\nimport/use_multiple_threads=true', { width: 640, height: 480 });
    expect(ini).not.toMatch(/use_multiple_threads=true/);
  });

  it('pins the viewport size so a reference render is reproducible', () => {
    const ini = projectConfig(null, { width: 640, height: 480 });
    expect(ini).toMatch(/window\/size\/viewport_width=640/);
    expect(ini).toMatch(/window\/size\/viewport_height=480/);
  });

  /**
   * `low_processor_mode` redraws only on change, so a settled scene never resumes the
   * bootstrap's `frame_post_draw` await, and the render ends "produced no image (exit 0)" with an
   * empty stderr. Godot recommends the setting for UI projects.
   */
  it('drops low_processor_mode, which stops the frame the capture awaits', () => {
    const source = '[application]\nconfig/name="Tool"\nrun/low_processor_mode=true';
    const ini = projectConfig(source, { width: 400, height: 300 });
    expect(ini).not.toMatch(/low_processor_mode/);
    expect(ini).toMatch(/config\/name="Tool"/);
  });

  it('overrides a source viewport size rather than emitting the key twice', () => {
    const source = '[display]\nwindow/size/viewport_width=1152\nwindow/size/viewport_height=648';
    const ini = projectConfig(source, { width: 400, height: 300 });
    expect(ini.match(/window\/size\/viewport_width=/g)).toHaveLength(1);
    expect(ini).toMatch(/window\/size\/viewport_width=400/);
  });

  /**
   * The root-window arm captures the window, so the window is the project-viewport rectangle. A
   * source override or a fullscreen window mode resizes it, and the stretch transform scales the
   * picture to a rect the previewer's 2D stage never draws.
   */
  const windowOverrides = [
    '[display]',
    'window/size/window_width_override=1920',
    'window/size/window_height_override=1080',
    'window/size/mode=3',
  ].join('\n');

  it('drops the window-size overrides when the window IS the capture', () => {
    const ini = projectConfig(windowOverrides, {
      width: 1152,
      height: 648,
      pinWindowToViewport: true,
    });
    expect(ini).not.toMatch(/window_width_override/);
    expect(ini).not.toMatch(/window_height_override/);
    expect(ini).not.toMatch(/window\/size\/mode=/);
    expect(ini).toMatch(/window\/size\/viewport_width=1152/);
  });

  it('keeps them otherwise, so no render that does not capture the window moves', () => {
    const ini = projectConfig(windowOverrides, { width: 400, height: 300 });
    expect(ini).toMatch(/window_width_override=1920/);
    expect(ini).toMatch(/window\/size\/mode=3/);
  });
});

/**
 * `main/main.cpp` and the `SceneTree` constructor hand some settings to the root `Window` only,
 * so a `SubViewport` keeps the class default and the 2D capture cannot observe them.
 * `--mode 2d-root` renders the scene as the root window, and the SubViewport arm reports each
 * such setting whose live root value differs from its own.
 */
describe('root-window-only viewport settings', () => {
  it('cites, for every listed property, where Godot applies it and where the default lives', () => {
    expect(ROOT_ONLY_VIEWPORT_PROPERTIES.length).toBeGreaterThan(0);
    for (const entry of ROOT_ONLY_VIEWPORT_PROPERTIES) {
      expect(entry.property).toMatch(/^[a-z0-9_]+$/);
      expect(entry.setting).toMatch(/^[a-z0-9_]+\//);
      // A `file:line` into the engine, never a fixture or an issue number, so a reader can
      // re-derive the list.
      expect(entry.appliedAt).toMatch(/^(main|scene)\/.+\.(cpp|h):\d+(-\d+)?$/);
      expect(entry.defaultAt).toMatch(/^scene\/main\/viewport\.h:\d+$/);
    }
  });

  it('names the two Godot call sites the whole limitation rests on', () => {
    const applied = ROOT_ONLY_VIEWPORT_PROPERTIES.map((e) => e.appliedAt);
    const settings = ROOT_ONLY_VIEWPORT_PROPERTIES.map((e) => e.setting);
    expect(settings).toContain('gui/common/snap_controls_to_pixels');
    expect(settings).toContain('rendering/2d/snap/snap_2d_transforms_to_pixel');
    expect(settings).toContain('rendering/2d/snap/snap_2d_vertices_to_pixel');
    expect(applied.some((at) => at.startsWith('main/main.cpp:'))).toBe(true);
    expect(applied.some((at) => at.startsWith('scene/main/scene_tree.cpp:'))).toBe(true);
  });

  /**
   * The comparison reads both viewports' live values, so it stays correct if an engine starts to
   * propagate one of these. `Object.get()` on a name Godot does not expose returns null on both
   * sides, which compares equal, so the script proves each name exists before it compares.
   */
  it('asks the engine for every listed property by name', () => {
    const script = bootstrap({ mode: '2d' });
    for (const { property } of ROOT_ONLY_VIEWPORT_PROPERTIES) {
      expect(script).toContain(`"${property}"`);
    }
  });

  it('proves each name exists on both viewports before comparing values', () => {
    const script = bootstrap({ mode: '2d' });
    expect(script).toContain('get_property_list()');
    expect(script).toContain('missing');
  });
});

describe('rootOnlyDriftMessage', () => {
  const drifted = {
    drift: [
      {
        property: 'gui_snap_controls_to_pixels',
        root: 'false',
        nested: 'true',
      },
    ],
    missing: [],
  };

  it('says nothing when the SubViewport agrees with the root window', () => {
    expect(rootOnlyDriftMessage({ drift: [], missing: [] })).toBeNull();
    expect(rootOnlyDriftMessage(null)).toBeNull();
  });

  it('names the setting, both values, and the mode that can answer', () => {
    const message = rootOnlyDriftMessage(drifted);
    expect(message).toContain('gui/common/snap_controls_to_pixels');
    expect(message).toContain('gui_snap_controls_to_pixels');
    expect(message).toContain('main/main.cpp:4577-4578');
    expect(message).toContain('scene/main/viewport.h:267');
    expect(message).toMatch(/root window false/);
    expect(message).toMatch(/this capture true/);
    expect(message).toContain('--mode 2d-root');
  });

  it('puts the setting and the remedy on the FIRST line, which is all a batch log keeps', () => {
    // `scripts/compare-docs/*` log only `error.message.split('\n')[0]` per scene.
    const [first] = rootOnlyDriftMessage(drifted).split('\n');
    expect(first).toContain('gui/common/snap_controls_to_pixels');
    expect(first).toContain('--mode 2d-root');
  });

  it('reports a name the engine no longer exposes as a harness bug, not a clean run', () => {
    const message = rootOnlyDriftMessage({ drift: [], missing: ['gui_snap_controls_to_pixels'] });
    expect(message).toContain('gui_snap_controls_to_pixels');
    expect(message).toContain('ADD_PROPERTY');
    // A missing name means the comparison proved nothing, so it does not read as agreement.
    expect(message).not.toMatch(/agrees/);
  });
});

/**
 * The two 2D arms. The SubViewport arm stays the default, since xvfb window management cannot
 * resize it. `2d-root` answers for the settings nothing nested can observe.
 */
describe('--mode 2d-root renders the scene as the root window', () => {
  it('adds the scene where SceneTree adds a main scene, not under a SubViewport', () => {
    const script = bootstrap({ mode: '2d-root' });
    expect(script).toContain('const ROOT_WINDOW := true');
    expect(script).toContain('get_tree().root.add_child(target)');
    expect(script).toContain('_save_capture(get_tree().root)');
  });

  it('asks for the particle advance the moment the subtree enters the tree, as the other arms do', () => {
    const lines = bootstrap({ mode: '2d-root', particles: 0.5 }).split('\n');
    const at = lines.indexOf('\tget_tree().root.add_child(target)');
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe('\t_advance_particles(target)');
  });

  it('still reports itself as a 2D render, since that is how the pair is made', () => {
    // `__ref_mode.txt` pairs this image with the previewer's 2D capture. Both arms draw the same
    // rectangle, so both say "2d".
    const script = bootstrap({ mode: '2d-root' });
    expect(script).toContain('var two_d := MODE == "2d" or MODE == "2d-root"');
  });

  it('leaves the SubViewport arm in place as the default', () => {
    const script = bootstrap({ mode: '2d' });
    expect(script).toContain('const ROOT_WINDOW := false');
    expect(script).toContain('var vp := SubViewport.new()');
    expect(script).toContain('_report_root_only_drift(vp)');
  });

  it('never reports drift from the root-window arm, which has nothing nested to compare', () => {
    // The root window's values are the ones in force there, so a report would compare the capture
    // against itself.
    expect(bootstrap({ mode: '2d-root' })).toContain('const DRIFT_OUT := ""');
    expect(bootstrap({ mode: '2d' })).not.toContain('const DRIFT_OUT := ""');
  });
});

describe('probePixels', () => {
  it('reads back the exact colour at each requested coordinate', async () => {
    const png = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 10;
      png.data[i + 1] = 20;
      png.data[i + 2] = 30;
      png.data[i + 3] = 255;
    }
    const idx = (2 * 4 + 1) * 4;
    png.data[idx] = 200;
    png.data[idx + 1] = 100;
    png.data[idx + 2] = 50;

    const buffer = PNG.sync.write(png);
    expect(probePixels(buffer, [[1, 2]])).toEqual([{ x: 1, y: 2, rgb: [200, 100, 50] }]);
    expect(probePixels(buffer, [[0, 0]])).toEqual([{ x: 0, y: 0, rgb: [10, 20, 30] }]);
  });

  it('rejects a probe outside the image instead of returning garbage', () => {
    const png = new PNG({ width: 2, height: 2 });
    const buffer = PNG.sync.write(png);
    expect(() => probePixels(buffer, [[5, 0]])).toThrow(/outside/i);
  });
});

/**
 * The editor preview runs no game logic, so the default pauses the tree: a RigidBody stays where
 * it was authored and a VehicleBody3D does not move its wheels. `--no-previews` asks for runtime
 * semantics, where a body falls.
 */
describe('physics pause follows the previews flag', () => {
  const script = (previews) => bootstrap({ previews });

  it('pauses under the editor previews, so the authored pose is what renders', () => {
    expect(script(true)).toContain('get_tree().paused = true');
    expect(script(true)).toContain('const PREVIEWS := true');
  });

  it('freezes the non-physics drivers only under the previews too', () => {
    // Both halves of "show the authored pose" hang off one flag, so an editor
    // render is wholly frozen and a runtime render is wholly live.
    const editor = script(true).split('\n');
    const freeze = editor.findIndex((l) => l.trim() === '_freeze_game_logic(target)');
    expect(freeze).toBeGreaterThan(-1);
    expect(editor[freeze - 1].trim()).toBe('if PREVIEWS:');
  });

  it('still emits the pause behind the PREVIEWS gate rather than hard-coding it', () => {
    // A copy of the line outside the `if` would pause a --no-previews render too.
    const lines = script(false).split('\n');
    const pauseLine = lines.findIndex((l) => l.includes('get_tree().paused = true'));
    expect(pauseLine).toBeGreaterThan(-1);
    expect(lines[pauseLine - 1].trim()).toBe('if PREVIEWS:');
    expect(script(false)).toContain('const PREVIEWS := false');
  });
});

/**
 * A pass that outlives its budget dies with its engine. Under a display the direct child is
 * `xvfb-run`, so a signal to it alone leaves `godot` running under init, holding an X display
 * lock that blocks the number for every later run.
 */
describe('an expired engine pass is reaped as a process group', () => {
  it('runs the display arm under the group killer, not bare xvfb-run', () => {
    const plan = godotSpawnPlan(['--path', '/tmp/work'], { display: true });
    // `timeout` reaps the group: coreutils' `timeout.c` calls `setpgid` unless `--foreground`,
    // then signals the group on expiry.
    expect(plan.command).toBe('timeout');
    expect(plan.argv.slice(0, 3)).toEqual(['-k', String(ENGINE_KILL_AFTER_S), String(ENGINE_TIMEOUT_S)]);
    // The engine still runs under a display, behind the wrapper.
    expect(plan.argv.slice(3, 5)).toEqual(['xvfb-run', '-a']);
    expect(plan.argv).toContain('godot');
  });

  it('escalates to SIGKILL for an engine that ignores the first signal', () => {
    const plan = godotSpawnPlan([], { display: true });
    expect(plan.argv[0]).toBe('-k');
    expect(Number(plan.argv[1])).toBeGreaterThan(0);
  });

  it('leaves spawnSync a strictly longer backstop, so it never pre-empts the group kill', () => {
    // A backstop at or below the group budget would fire first and signal only the wrapper,
    // which orphans the engine.
    expect(SPAWN_BACKSTOP_MS).toBeGreaterThan((ENGINE_TIMEOUT_S + ENGINE_KILL_AFTER_S) * 1000);
    expect(godotSpawnPlan([], { display: true }).timeoutMs).toBe(SPAWN_BACKSTOP_MS);
  });

  it('keeps the screen flag between the wrapper and the engine when one is asked for', () => {
    const plan = godotSpawnPlan(['--path', '/tmp/work'], {
      display: true,
      screen: { width: 1152, height: 648 },
    });
    const s = plan.argv.indexOf('-s');
    expect(plan.argv[s + 1]).toBe('-screen 0 1152x648x24');
    // xvfb-run's own flags must precede `godot`.
    expect(s).toBeGreaterThan(plan.argv.indexOf('xvfb-run'));
    expect(s).toBeLessThan(plan.argv.indexOf('godot'));
  });

  it('still runs the headless import arm, which has no wrapper to orphan', () => {
    const plan = godotSpawnPlan(['--headless', '--import'], { display: false });
    expect(plan.command).toBe('timeout');
    expect(plan.argv).not.toContain('xvfb-run');
    expect(plan.argv[plan.argv.indexOf('godot') + 1]).toBe('--headless');
  });

  it('makes the Vulkan loader pick lavapipe, the driver the comparison browser renders on', () => {
    // On a host with a GPU, the loader would otherwise pick the GPU's driver.
    for (const display of [true, false]) {
      const plan = godotSpawnPlan([], { display });
      expect(plan.env).toMatchObject(LAVAPIPE_LOADER_ENV);
    }
  });

  it('falls back to spawning the engine directly where the group killer is absent', () => {
    const plan = godotSpawnPlan(['--path', '/tmp/work'], {
      display: true,
      groupTimeout: false,
    });
    expect(plan.command).toBe('xvfb-run');
    expect(plan.argv).not.toContain('timeout');
  });
});

/**
 * A stalled import leaves assets unimported, and the render would save a picture without them as
 * the reference.
 */
describe('a stalled import pass is never rendered over', () => {
  const pass = (fields) => ({ status: 0, error: null, timedOut: false, stdout: '', stderr: '', ...fields });
  const stalledPass = pass({ status: 124, timedOut: true, stderr: 'importing fonts' });

  it.each([124, 137])('classifies exit %i as stalled', (status) => {
    expect(enginePassStalled(pass({ status, timedOut: true }))).toBe(true);
  });

  it('classifies a spawn error as stalled', () => {
    expect(enginePassStalled(pass({ status: null, error: new Error('spawn godot ENOENT') }))).toBe(true);
  });

  it('classifies a plain non-zero exit as done', () => {
    expect(enginePassStalled(pass({ status: 1 }))).toBe(false);
  });

  it('throws naming the import pass, the timeout and stderr after two stalls', async () => {
    let runs = 0;
    await expect(importAssets({ run: () => (runs++, stalledPass), restage: async () => {} })).rejects.toThrow(
      new RegExp(`import pass did not finish within ${ENGINE_TIMEOUT_S}s[\\s\\S]*importing fonts`)
    );
    expect(runs).toBe(2);
  });

  it('restages a clean project before the second try', async () => {
    const events = [];
    const results = [stalledPass, pass()];
    await importAssets({
      run: () => (events.push('run'), results.shift()),
      restage: async () => events.push('restage'),
    });
    expect(events).toEqual(['run', 'restage', 'run']);
  });

  it('does not retry a plain non-zero exit', async () => {
    let runs = 0;
    await importAssets({ run: () => (runs++, pass({ status: 1 })), restage: async () => {} });
    expect(runs).toBe(1);
  });
});

/**
 * The pause holds everything driven by NOTIFICATION_*_PROCESS at the load instant, but
 * NOTIFICATION_DRAW is not pause-gated, so a node that catches up at first draw reads one process
 * delta. `--fixed-fps` makes that delta a constant instead of this host's time to the first frame.
 */
describe('the reference renders on a fixed clock', () => {
  it('passes --fixed-fps to the render pass', () => {
    const argv = renderArgv('/tmp/work');
    const at = argv.indexOf('--fixed-fps');
    expect(at).toBeGreaterThan(-1);
    expect(argv[at + 1]).toBe(String(REFERENCE_FIXED_FPS));
  });

  it('keeps the delta under a frame of any emitter that pins its own step', () => {
    // `CPUParticles2D::_update_internal` advances past `preprocess` by whole
    // `1/fixed_fps` steps while `todo >= frame_time`. The corpus pins emitters
    // at 30; a delta below that frame floors the step count to zero, which is
    // what puts both harnesses on the same simulated frame.
    expect(1 / REFERENCE_FIXED_FPS).toBeLessThan(1 / 30);
  });

  it('refuses a non-zero settle without blaming the missing flag', () => {
    // The delta is fixed, so the pause and the previewer's missing hook stop a scene-wide window.
    // The message names them and points at the per-subsystem advance that exists.
    const ask = () => bootstrap({ simSeconds: 0.5 });
    expect(ask).toThrow(/paused before the scene is ever instantiated/);
    expect(ask).toThrow(/--particles/);
  });
});

describe('harnessWarnings', () => {
  it('keeps the warnings the bootstrap prints, from all the engine writes to stderr', () => {
    const stderr = [
      'WARNING: All audio drivers failed, falling back to the dummy driver.',
      'godot-ref: the picture did not settle, so it is captured as it stands',
      '     at: initialize (servers/audio/audio_server.cpp:247)',
    ].join('\n');

    expect(harnessWarnings(stderr)).toEqual([
      'godot-ref: the picture did not settle, so it is captured as it stands',
    ]);
  });
});

describe('the render wait fits inside the render pass', () => {
  it('quits after more frames than the longest fog convergence and its quiet window draw', () => {
    const argv = renderArgv('/tmp/work');
    const quitAfter = Number(argv[argv.indexOf('--quit-after') + 1]);

    expect(quitAfter).toBeGreaterThan(NEVER_SETTLES_CAPTURE_FRAME);
  });

  it('cycles over the jitters the previewer averages', async () => {
    const { VOLUMETRIC_FOG_TEMPORAL_JITTERS } =
      await import('../../packages/textscene-core/src/godot/rendering/environment/volumetricFog.ts');

    expect(FOG_JITTER_CYCLE_FRAMES).toBe(VOLUMETRIC_FOG_TEMPORAL_JITTERS.length);
  });

  it('gives the bootstrap the cycle length, the caps and the quiet window (edge case: the GDScript holds its own copy)', () => {
    expect(bootstrap()).toContain(`const FOG_JITTER_CYCLE_FRAMES := ${FOG_JITTER_CYCLE_FRAMES}`);
    expect(bootstrap()).toContain(`const FOG_HISTORY_MAX_CYCLES := ${FOG_HISTORY_MAX_CYCLES}`);
    expect(bootstrap()).toContain(`const RENDER_QUIET_FRAMES := ${RENDER_QUIET_FRAMES}`);
    expect(bootstrap()).toContain(`const RENDER_QUIET_MSEC := ${RENDER_QUIET_MSEC}`);
    expect(bootstrap()).toContain(`const NEVER_SETTLES_CAPTURE_FRAME := ${NEVER_SETTLES_CAPTURE_FRAME}`);
    expect(bootstrap()).toContain(`const CONVERGENCE_FRAMES := ${CONVERGENCE_FRAMES}`);
  });

  it('captures a scene that never settles at the frame and frame rate core replays relay cycles to', async () => {
    const { HARNESS_CAPTURE } =
      await import('../../packages/textscene-core/src/godot/scene/transformFlushes.ts');

    expect(HARNESS_CAPTURE).toEqual({ frame: NEVER_SETTLES_CAPTURE_FRAME, fixedFps: REFERENCE_FIXED_FPS });
  });

  it('ends the wait at that process frame, so frames spent before it do not move the capture', () => {
    // Process frames count from 0, so the last wait frame is one less than the frames drawn.
    expect(NEVER_SETTLES_CAPTURE_FRAME).toBe(CONVERGENCE_FRAMES + RENDER_WAIT_MAX_FRAMES - 1);
    const wait = bootstrap().split('func _await_rendered')[1].split('\nfunc ')[0];
    expect(wait).toMatch(/while Engine\.get_process_frames\(\) < NEVER_SETTLES_CAPTURE_FRAME:/);
  });

  it('holds the quiet window only while every global transform holds still', () => {
    // A paused tree still runs transform notifications, so a relay cycle moves its nodes on every
    // frame, after the picture has lost them.
    const wait = bootstrap().split('func _await_rendered')[1].split('\nfunc ')[0];

    expect(wait).toMatch(/var now_transforms := _global_transforms\(movers\)/);
    expect(wait).toMatch(/if repeats and now_pending == pending and now_transforms == transforms:/);
  });
});

/**
 * A channel whose value x 255 is fractional moves with the rasteriser, since the blend's tie-break
 * is implementation-defined. Swapping drivers from the CLI tells such a one-step gap apart from a
 * parity defect.
 */
describe('--rendering-driver', () => {
  it('defaults to the engine default rather than naming one', () => {
    expect(parseArgs(['a.tscn']).renderingDriver).toBeNull();
    expect(renderArgv('/tmp/work')).not.toContain('--rendering-driver');
  });

  it('reaches the render pass', () => {
    const args = parseArgs(['a.tscn', '--rendering-driver', 'opengl3']);
    expect(args.renderingDriver).toBe('opengl3');
    const argv = renderArgv('/tmp/work', { renderingDriver: args.renderingDriver });
    expect(argv[argv.indexOf('--rendering-driver') + 1]).toBe('opengl3');
  });

  it('refuses a driver the engine does not have', () => {
    expect(() => parseArgs(['a.tscn', '--rendering-driver', 'directx'])).toThrow(/--rendering-driver/);
  });
});

/**
 * Godot renders with OpenGL 3 when Vulkan does not start, and still writes an image. A
 * Compatibility picture answers a Forward+ parity question wrongly, so the harness compares the
 * method that drew the frame with the one it asked for.
 */
describe('a renderer fallback', () => {
  it('asks for Forward+ when neither the flag nor the project names a method', () => {
    expect(requestedRenderingMethod(null, null)).toBe(DEFAULT_RENDERING_METHOD);
    expect(DEFAULT_RENDERING_METHOD).toBe('forward_plus');
  });

  it("asks for the source project's method", () => {
    const ini = '[rendering]\n\nrenderer/rendering_method="gl_compatibility"\n';
    expect(requestedRenderingMethod(ini, null)).toBe('gl_compatibility');
  });

  it("asks for the method of the driver the flag names, over the project's", () => {
    const ini = '[rendering]\nrenderer/rendering_method="mobile"\n';
    expect(requestedRenderingMethod(ini, 'opengl3')).toBe('gl_compatibility');
  });

  it("ignores the project's per-platform override, which a desktop run does not read (edge case)", () => {
    const ini = '[rendering]\nrenderer/rendering_method.mobile="gl_compatibility"\n';
    expect(requestedRenderingMethod(ini, null)).toBe(DEFAULT_RENDERING_METHOD);
  });

  it('answers when the engine drew with the method asked for', () => {
    expect(
      renderingMethodFallbackMessage('forward_plus', { method: 'forward_plus', driver: 'vulkan' })
    ).toBeNull();
  });

  it('refuses a fallback, naming both methods and the way out (error case)', () => {
    const message = renderingMethodFallbackMessage('forward_plus', {
      method: 'gl_compatibility',
      driver: 'opengl3',
    });
    expect(message).toMatch(/asks for forward_plus/);
    expect(message).toMatch(/gl_compatibility \(opengl3\)/);
    expect(message).toMatch(/--rendering-driver/);
  });

  it('answers when the bootstrap wrote no report (edge case)', () => {
    expect(renderingMethodFallbackMessage('forward_plus', null)).toBeNull();
  });

  it('writes the report from the bootstrap, after the pause', () => {
    const script = bootstrap({ rendererOut: '/tmp/r.json' });
    expect(script).toContain('const RENDERER_OUT := "/tmp/r.json"');
    expect(script).toContain('RenderingServer.get_current_rendering_method()');
    expect(script.indexOf('_write_renderer()\n')).toBeGreaterThan(script.indexOf('get_tree().paused = true'));
  });

  it('reports the device that drew the frame', () => {
    expect(bootstrap({ rendererOut: '/tmp/r.json' })).toContain('RenderingServer.get_video_adapter_name()');
  });
});

describe('renderingDeviceMessage', () => {
  it('answers when lavapipe drew a Vulkan frame', () => {
    expect(
      renderingDeviceMessage({
        method: 'forward_plus',
        driver: 'vulkan',
        adapter: 'llvmpipe (LLVM 22.1.8, 256 bits)',
      })
    ).toBeNull();
  });

  it('refuses a Vulkan frame from a GPU, naming the device and the package (error case)', () => {
    const message = renderingDeviceMessage({
      method: 'forward_plus',
      driver: 'vulkan',
      adapter: 'Intel(R) UHD Graphics 630 (CFL GT2)',
    });
    expect(message).toMatch(/Intel\(R\) UHD Graphics 630/);
    expect(message).toMatch(/mesa-vulkan-drivers/);
  });

  it('answers for an OpenGL frame, which Xvfb draws in software on every host (edge case)', () => {
    expect(
      renderingDeviceMessage({
        method: 'gl_compatibility',
        driver: 'opengl3',
        adapter: 'llvmpipe (LLVM 22.1.8, 256 bits)',
      })
    ).toBeNull();
  });

  it('answers when the bootstrap wrote no report (edge case)', () => {
    expect(renderingDeviceMessage(null)).toBeNull();
  });
});

/**
 * The Node3D editor runs no game logic, which the pause mirrors, but it runs particles:
 * `set_process_internal` is called unconditionally on ENTER_TREE. `--particles <seconds>` asks
 * for a named instant, spent through Godot's own settle loop.
 */
describe('--particles advances the emitters by a named number of seconds', () => {
  it('defaults to zero, so no reference already taken through this harness moves', () => {
    expect(PARTICLES_PROCESS_DEFAULT).toBe(0);
    expect(parseArgs(['scene.tscn']).particles).toBe(0);
  });

  it('reads a fractional number of seconds', () => {
    expect(parseArgs(['scene.tscn', '--particles', '0.95']).particles).toBe(0.95);
  });

  it('takes an explicit zero rather than treating it as a missing value', () => {
    expect(parseArgs(['scene.tscn', '--particles', '0']).particles).toBe(0);
  });

  it('rejects a negative advance instead of rendering an unmoved emitter', () => {
    expect(() => parseArgs(['scene.tscn', '--particles', '-1'])).toThrow(/non-negative/);
  });

  it('emits no request at all at the default, so the generated script is inert', () => {
    // The guard is inside `_advance_particles`, so the walk still appears in
    // the source. What must not appear is a call reaching an emitter.
    expect(bootstrap({ particles: 0 })).toContain('const PARTICLES_PROCESS := 0');
  });

  it('asks Godot for the advance through its own API, before any frame runs', () => {
    const lines = bootstrap({ particles: 0.95 }).split('\n');
    expect(lines).toContain('const PARTICLES_PROCESS := 0.95');
    // `_update_internal` zeroes `_requested_process_time` on its first pass. A 2D emitter spends the
    // request at its first draw, so that path asks right after the subtree enters the tree. A 3D
    // emitter spends it at the enter-tree notification, so that path asks before.
    const at3d = lines.indexOf('\tadd_child(target)');
    expect(at3d).toBeGreaterThan(0);
    expect(lines[at3d - 1]).toBe('\t_advance_particles(target)');
    const at2d = lines.indexOf('\tvp.add_child(target)');
    expect(at2d).toBeGreaterThan(-1);
    expect(lines[at2d + 1]).toBe('\t_advance_particles(target)');
    expect(lines.some((l) => l.includes('request_particles_process(PARTICLES_PROCESS)'))).toBe(true);
  });

  it('advances CPUParticles only, since a GPU emitter has no pose on our side', () => {
    const body = bootstrap({ particles: 0.5 });
    expect(body).toContain('node is CPUParticles2D');
    expect(body).toContain('node is CPUParticles3D');
    expect(body).not.toContain('GPUParticles2D)');
    expect(body).not.toContain('GPUParticles3D)');
  });
});
