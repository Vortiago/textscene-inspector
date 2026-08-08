/**
 * Unit tests for the pure pieces of the Godot reference-render harness.
 *
 * The harness answers parity questions by rendering a scene through the REAL
 * engine, so its correctness is mostly "did Godot draw the right picture" —
 * covered by the engine-gated smoke test at the bottom, which is skipped
 * wherever `godot`/`xvfb-run` are absent (i.e. CI).
 *
 * What IS pure, and tested here, is the setup that decides WHAT Godot is asked
 * to draw. Two of those decisions are load-bearing for ADR-0025:
 *
 * - `godot --path` runs the GAME, and the preview sun / preview environment are
 *   `Node3DEditor` members that exist only in the editor. A reference render
 *   must therefore INJECT them under Godot's own yield rule, or it depicts a
 *   Godot that never lit the scene.
 * - A project's `default_environment` would silently light the scene too. The
 *   previewer has no such notion, so the generated project must not carry one
 *   even when the source project declares it.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import {
  CANVAS_2D_CAPTURE,
  CANVAS_CAPTURE,
  FIT_ON_OPEN_2D_STORAGE_KEY,
  VIEWPORT,
} from '../visual/previewServer.mjs';
import { bootstrapScript,
  EDITOR_CAMERA_DIRECTION,
  EDITOR_CAMERA_DISTANCE,
  EDITOR_FOV,
  ENGINE_KILL_AFTER_S,
  ENGINE_TIMEOUT_S,
  FRAME_MARGIN,
  godotSpawnPlan,
  PARTICLES_PROCESS_DEFAULT,
  parseArgs,
  REFERENCE_FIXED_FPS,
  renderArgv,
  SPAWN_BACKSTOP_MS,
  resolveProjectRoot,
  projectConfig,
  probePixels,
  renderReference,
  ROOT_ONLY_VIEWPORT_PROPERTIES,
  rootOnlyDriftMessage,
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
 * The harness hand-mirrors the previewer's editor-camera constants because it
 * generates GDScript and runs under plain node. Nothing else pins the two
 * copies together, and a one-sided edit does not fail — it makes `ref:godot`
 * and `ref:ours` frame different pictures while both appear to work, which is
 * exactly the silent zoom skew that once cost a whole false lead (the sky curve
 * was blamed for a mismatch that was really fov 75 against fov 70).
 */
describe('editor-camera constants mirror the previewer', () => {
  it('matches godotEditorCamera.ts', async () => {
    const { editorCameraDirection, EDITOR_CAMERA_DISTANCE: coreDistance, EDITOR_CAMERA_FOV } =
      await import('../../packages/textscene-core/src/r3f/godotEditorCamera.ts');
    const core = editorCameraDirection();
    expect(EDITOR_CAMERA_DIRECTION[0]).toBeCloseTo(core.x, 6);
    expect(EDITOR_CAMERA_DIRECTION[1]).toBeCloseTo(core.y, 6);
    expect(EDITOR_CAMERA_DIRECTION[2]).toBeCloseTo(core.z, 6);
    expect(EDITOR_CAMERA_DISTANCE).toBe(coreDistance);
    expect(EDITOR_FOV).toBe(EDITOR_CAMERA_FOV);
  });

  it('matches frameSceneBounds.ts’s framing margin', async () => {
    const { FRAME_MARGIN: coreMargin } = await import(
      '../../packages/textscene-core/src/r3f/frameSceneBounds.ts'
    );
    expect(FRAME_MARGIN).toBe(coreMargin);
  });

  /**
   * The 2D pair has no camera to agree on — it agrees on a RECTANGLE instead:
   * Godot renders the project viewport through a SubViewport of this size, and
   * the previewer's stage draws a frame of exactly the same size at zoom 1. A
   * one-sided edit here produces two images that still look right individually
   * and cannot be compared at all (a Control's anchors resolve against the
   * frame, so its content MOVES with it).
   */
  it('matches viewport2d.ts’s project-viewport rectangle and its fit preference', async () => {
    const { CANVAS_2D_WIDTH, CANVAS_2D_HEIGHT, FIT_ON_OPEN_2D_STORAGE_KEY: coreKey } =
      await import(
        '../../packages/textscene-core/src/r3f/components/Canvas2DStage/viewport2d.ts'
      );
    expect(CANVAS_2D_CAPTURE.width).toBe(CANVAS_2D_WIDTH);
    expect(CANVAS_2D_CAPTURE.height).toBe(CANVAS_2D_HEIGHT);
    expect(FIT_ON_OPEN_2D_STORAGE_KEY).toBe(coreKey);
  });

  it('gives a 2D capture room for the frame at zoom 1', () => {
    // The stage is what remains of the browser viewport after the shell's dock
    // and top bar; a frame that does not FIT it is clipped, and the capture
    // quietly picks up the shell's chrome at the edges instead of the scene.
    const chrome = {
      width: VIEWPORT.width - CANVAS_CAPTURE.width,
      height: VIEWPORT.height - CANVAS_CAPTURE.height,
    };
    expect(CANVAS_2D_CAPTURE.viewport.width - chrome.width).toBeGreaterThanOrEqual(
      CANVAS_2D_CAPTURE.width
    );
    expect(CANVAS_2D_CAPTURE.viewport.height - chrome.height).toBeGreaterThanOrEqual(
      CANVAS_2D_CAPTURE.height
    );
  });
});

describe('parseArgs', () => {
  it('takes the scene as the sole positional argument', () => {
    expect(parseArgs(['scenes/fixtures/unit-plane-mesh.tscn']).scene).toBe(
      'scenes/fixtures/unit-plane-mesh.tscn'
    );
  });

  it('defaults to the frame our own capture produces, and previews to on', () => {
    // Not an arbitrary size: a bare `ref:godot` and a bare `ref:ours` have to
    // put a probe at (x, y) on the same surface point, which needs the same
    // pixels AND the same aspect ratio.
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
    // scenes/fixtures is a flat bag of scenes with res:// paths relative to
    // itself, and deliberately carries no project file.
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

  it('pins the viewport size so a reference render is reproducible', () => {
    const ini = projectConfig(null, { width: 640, height: 480 });
    expect(ini).toMatch(/window\/size\/viewport_width=640/);
    expect(ini).toMatch(/window\/size\/viewport_height=480/);
  });

  it('overrides a source viewport size rather than emitting the key twice', () => {
    const source = '[display]\nwindow/size/viewport_width=1152\nwindow/size/viewport_height=648';
    const ini = projectConfig(source, { width: 400, height: 300 });
    expect(ini.match(/window\/size\/viewport_width=/g)).toHaveLength(1);
    expect(ini).toMatch(/window\/size\/viewport_width=400/);
  });

  /**
   * The root-window arm captures the WINDOW, so the window has to be the
   * project-viewport rectangle exactly. A source override (or a fullscreen
   * window mode) sizes it to something else, and the stretch transform then
   * scales the whole picture — a rect the previewer's 2D stage never draws.
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
 * ROOT-WINDOW-ONLY VIEWPORT SETTINGS.
 *
 * Godot hands a handful of project settings to `SceneTree`'s root `Window` and
 * to NOTHING else — `main/main.cpp` and the `SceneTree` constructor both do it —
 * while `Viewport` initialises its own field to a class default. Anything drawn
 * inside a `SubViewport` therefore keeps that default however the project is
 * configured, so the harness's 2D capture (which composes the whole scene inside
 * one) is structurally incapable of observing them.
 *
 * Two halves answer that: `--mode 2d-root` renders the scene AS the root window,
 * and the SubViewport arm reports every such setting whose live root value
 * differs from its own rather than returning a confident wrong picture.
 */
describe('root-window-only viewport settings', () => {
  it('cites, for every listed property, where Godot applies it and where the default lives', () => {
    expect(ROOT_ONLY_VIEWPORT_PROPERTIES.length).toBeGreaterThan(0);
    for (const entry of ROOT_ONLY_VIEWPORT_PROPERTIES) {
      expect(entry.property).toMatch(/^[a-z0-9_]+$/);
      expect(entry.setting).toMatch(/^[a-z0-9_]+\//);
      // A `file:line` into the engine, never a fixture or an issue number: the
      // list is only trustworthy if the next reader can re-derive it.
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
   * The comparison reads BOTH viewports' live values instead of re-deriving
   * Godot's defaults in GDScript, so it stays correct if a future engine starts
   * propagating one of these. That only holds while the property NAMES are
   * real: `Object.get()` on a name Godot does not expose returns null on both
   * sides, the two compare equal, and the check reports "no divergence" — the
   * exact silence this exists to end. So the generated script proves each name
   * exists on both viewports before it compares anything.
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
    // `scripts/compare-docs/*` log `error.message.split('\n')[0]` per scene and
    // carry on, so a summary line that names neither is a dead end there.
    const [first] = rootOnlyDriftMessage(drifted).split('\n');
    expect(first).toContain('gui/common/snap_controls_to_pixels');
    expect(first).toContain('--mode 2d-root');
  });

  it('reports a name the engine no longer exposes as a harness bug, not a clean run', () => {
    const message = rootOnlyDriftMessage({ drift: [], missing: ['gui_snap_controls_to_pixels'] });
    expect(message).toContain('gui_snap_controls_to_pixels');
    expect(message).toContain('ADD_PROPERTY');
    // A missing name means the comparison proved NOTHING, so it must not read
    // as agreement.
    expect(message).not.toMatch(/agrees/);
  });
});

/**
 * The two 2D arms. The SubViewport one is what makes the capture a fixed,
 * project-viewport-sized rectangle independent of window management under
 * xvfb, so it stays the default; `2d-root` is the second answer, for the
 * settings nothing nested can observe.
 */
describe('--mode 2d-root renders the scene as the root window', () => {
  it('adds the scene where SceneTree adds a main scene, not under a SubViewport', () => {
    const script = bootstrap({ mode: '2d-root' });
    expect(script).toContain('const ROOT_WINDOW := true');
    expect(script).toContain('get_tree().root.add_child(target)');
    expect(script).toContain('get_tree().root.get_texture()');
  });

  it('asks for the particle advance the moment the subtree enters the tree, as the other arms do', () => {
    const lines = bootstrap({ mode: '2d-root', particles: 0.5 }).split('\n');
    const at = lines.indexOf('\tget_tree().root.add_child(target)');
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe('\t_advance_particles(target)');
  });

  it('still reports itself as a 2D render, since that is how the pair is made', () => {
    // `__ref_mode.txt` is what pairs this image with the previewer's 2D
    // capture; both arms draw the same rectangle, so both say "2d".
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
    // The root window's values ARE the ones in force there, so a report would
    // be comparing the capture against itself.
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
 * The acceptance test: a scene with NO lighting of its own must come back lit,
 * because the harness injected Godot's preview sun and preview environment.
 * Engine-gated — `godot` and `xvfb-run` are developer tools here, not CI ones.
 */
const hasEngine =
  spawnSync('which', ['godot']).status === 0 && spawnSync('which', ['xvfb-run']).status === 0;

describe.skipIf(!hasEngine)('renderReference (real Godot)', () => {
  // Each render needs somewhere to write; on a tmpfs /tmp these otherwise
  // accumulate in RAM for every suite run, which is how ~250 of them piled up
  // before anyone looked.
  const scratch = [];
  const scratchDir = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'godot-ref-'));
    scratch.push(dir);
    return dir;
  };
  afterAll(async () => {
    await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  const scene = join(import.meta.dirname, 'scenes', 'preview-lighting.tscn');
  const SKY = [200, 8];
  const GROUND = [200, 292];

  async function render(previews) {
    const out = join(await scratchDir(), 'shot.png');
    await renderReference({
      scene,
      out,
      width: 400,
      height: 300,
      previews,
      camera: [0, 1.5, 4],
      lookAt: [0, 0.8, 0],
    });
    expect(existsSync(out)).toBe(true);
    const [sky, ground] = probePixels(await readFile(out), [SKY, GROUND]);
    return { sky: sky.rgb, ground: ground.rgb };
  }

  it('injects the preview environment, so a scene with no lighting renders a sky', async () => {
    const { sky } = await render(true);
    // Godot's preview sky above the horizon is blue-grey: blue dominates, and
    // it is far brighter than the flat default clear colour a runtime render
    // would leave there.
    expect(sky[2]).toBeGreaterThan(sky[0]);
    expect(Math.max(...sky)).toBeGreaterThan(120);
  }, 180_000);

  /**
   * `--emit-bounds` exists so both renderers can derive ONE camera, which only
   * works if it measures what the previewer frames on. `frameSceneBounds.ts`
   * unions MESHES (falling back to gizmos when a scene has none), but in Godot
   * a Light3D is a VisualInstance3D too — so unioning every visual dragged the
   * centre towards a light the previewer never framed on, and a sun 5 units up
   * moved the derived look-at by 3.
   */
  it('bounds the GEOMETRY, not every VisualInstance3D', async () => {
    const dir = await scratchDir();
    const out = join(dir, 'shot.png');
    const boundsOut = join(dir, 'shot.bounds.json');
    await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-light-transport-direct.tscn'),
      out,
      boundsOut,
      width: 160,
      height: 120,
      previews: true,
    });
    const b = JSON.parse(await readFile(boundsOut, 'utf8'));
    // These bounds exist to derive ONE camera both renderers can use, so they
    // obey the same rule frameSceneBounds.ts does: geometry first. Light3D is a
    // VisualInstance3D too, and this fixture's sun sits 5 units above an 8x8
    // plane — unioning every visual put the centre at y=3 instead of y=0 and
    // silently framed the reference 3 units above the previewer.
    expect(b.position[1]).toBeCloseTo(0, 3);
    expect(b.size[1]).toBeLessThan(0.5);
    expect(b.size[0]).toBeCloseTo(8, 3);
    expect(b.size[2]).toBeCloseTo(8, 3);
  }, 180_000);

  /**
   * The reference must show the AUTHORED pose, not a running game. `_settle()`
   * steps six process frames, through which a live RigidBody3D FALLS — and this
   * fixture has no floor, so it never stops. The previewer never runs physics,
   * so the harness freezes game logic before settling and the crate has to stay
   * where the scene put it. Its 1x1 box is centred at y=1, so the geometry AABB
   * floor sits at y=0.5; a crate that fell through settle reports a lower floor.
   */
  it('freezes physics so a RigidBody keeps its authored pose through settle', async () => {
    const dir = await scratchDir();
    const out = join(dir, 'shot.png');
    const boundsOut = join(dir, 'shot.bounds.json');
    await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-rigidbody3d.tscn'),
      out,
      boundsOut,
      width: 160,
      height: 120,
      previews: true,
    });
    const b = JSON.parse(await readFile(boundsOut, 'utf8'));
    expect(b.position[1]).toBeCloseTo(0.5, 1);
    expect(b.size[1]).toBeCloseTo(1, 1);
  }, 180_000);

  /**
   * SoftBody3D has no freeze property, and (unlike a RigidBody) its `get_aabb`
   * keeps reporting the REST AABB even as the physics server integrates its mesh
   * every process frame — so an unpinned cloth FALLS and drapes away from the
   * authored rest mesh the previewer shows, invisibly to the bounds. The harness
   * disables the node to hold it at rest; this is measured from the render. The
   * fixture's 2×2 plane fills the framed centre at rest; unfrozen it falls out of
   * the centre within a few settle frames (a ~25% whole-frame change), leaving the
   * dark preview-environment ground there instead of bright cloth.
   */
  it('freezes SoftBody3D so an unpinned cloth keeps its rest mesh through settle', async () => {
    const out = join(await scratchDir(), 'shot.png');
    await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-softbody3d.tscn'),
      out,
      mode: '3d',
      frame: true,
    });
    const buffer = await readFile(out);
    const png = PNG.sync.read(buffer);
    const [centre] = probePixels(
      buffer,
      [[Math.floor(png.width / 2), Math.floor(png.height / 2)]],
      { patch: 15 }
    );
    expect(Math.min(...centre.rgb)).toBeGreaterThan(150);
  }, 180_000);

  /**
   * The 2D path, end to end: a Node2D scene must come back as the PROJECT
   * VIEWPORT rectangle — the frame the previewer's 2D stage draws — with the
   * scene in it and no 3D camera anywhere near it. Rendered through the 3D
   * path such a scene comes back the wrong size, over a sky, with its content
   * laid out against a rectangle nothing else uses.
   */
  it('renders a 2D scene as the project viewport, cleared to the 2D background', async () => {
    const out = join(await scratchDir(), 'canvas.png');
    const { mode } = await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-line2d.tscn'),
      out,
    });
    expect(mode).toBe('2d');
    const buffer = await readFile(out);
    const png = PNG.sync.read(buffer);
    expect([png.width, png.height]).toEqual([CANVAS_2D_CAPTURE.width, CANVAS_2D_CAPTURE.height]);

    // Bottom-right corner: empty canvas, so the clear colour our side flattens
    // its stage background to.
    const [corner] = probePixels(buffer, [[png.width - 8, png.height - 8]], { patch: 5 });
    const background = CANVAS_2D_CAPTURE.background;
    expect(corner.rgb).toEqual([1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16)));
    // …and the scene itself: the fixture's white line runs through the upper
    // left, so SOMETHING far brighter than the background is drawn there.
    const [line] = probePixels(buffer, [[150, 150]], { patch: 21 });
    expect(Math.min(...line.rgb)).toBeGreaterThan(150);
  }, 180_000);

  /**
   * THE ROOT-WINDOW ARM, measured on the one thing a nested capture cannot see.
   *
   * The scene draws the SAME four-deep chain of half-pixel Control offsets
   * twice — once directly in whatever viewport the capture composes into, once
   * inside a SubViewport of its own — under a project that turns
   * `gui/common/snap_controls_to_pixels` off. Godot hands that setting to the
   * root Window alone, so the direct arm is unsnapped only when it is the root
   * window's own scene; the nested arm snaps either way and is the control that
   * proves the mode did not simply shift the whole picture.
   *
   * The offsets accumulate 4 x 0.5 = 2 px, so the two placements are 2 px apart
   * in each axis and both land on whole pixels — no rasteriser fill rule enters
   * the reading. Probed at `patch: 1`, because a wider patch's median straddles
   * exactly the 2 px being measured.
   */
  const snapScene = join(
    REPO_ROOT,
    'scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn'
  );
  const UNSNAPPED_ONLY = [102, 62];
  const SNAPPED_ONLY = [142, 102];
  const NESTED_ARM = [504, 364];
  const GREEN = [0, 255, 0];
  const BACKDROP = [0, 0, 102];

  it('sees the root window’s opt-out, which the SubViewport capture cannot', async () => {
    const out = join(await scratchDir(), 'root-window.png');
    const { mode } = await renderReference({ scene: snapScene, out, mode: '2d-root' });
    expect(mode).toBe('2d');
    const buffer = await readFile(out);
    const png = PNG.sync.read(buffer);
    expect([png.width, png.height]).toEqual([CANVAS_2D_CAPTURE.width, CANVAS_2D_CAPTURE.height]);

    const [unsnapped, snapped, nested] = probePixels(
      buffer,
      [UNSNAPPED_ONLY, SNAPPED_ONLY, NESTED_ARM],
      { patch: 1 }
    );
    expect(unsnapped.rgb).toEqual(GREEN);
    expect(snapped.rgb).toEqual(BACKDROP);
    // The nested arm is inside a SubViewport in BOTH modes, so it must not move.
    expect(nested.rgb).toEqual(GREEN);
  }, 180_000);

  it('refuses the SubViewport capture for that project instead of answering with the default', async () => {
    const out = join(await scratchDir(), 'nested.png');
    await expect(renderReference({ scene: snapScene, out, mode: '2d' })).rejects.toThrow(
      /gui\/common\/snap_controls_to_pixels/
    );
    await expect(renderReference({ scene: snapScene, out, mode: '2d' })).rejects.toThrow(
      /--mode 2d-root/
    );
  }, 360_000);

  it('lights the scene only because of the previews — --no-previews is runtime semantics', async () => {
    const [lit, unlit] = [await render(true), await render(false)];
    // The same geometry, the same camera. With the previews the ground is a
    // brightly lit plane; without them it is an unlit silhouette, which is
    // what `godot --path` (the running game) actually shows.
    expect(Math.max(...lit.ground)).toBeGreaterThan(3 * Math.max(...unlit.ground));
    expect(Math.max(...unlit.ground)).toBeLessThan(80);
  }, 360_000);
});

/**
 * The harness has two jobs and one flag that selects between them. The editor
 * preview never runs game logic, so the default pauses the tree — that is what
 * keeps a RigidBody where it was authored and stops VehicleBody3D repositioning
 * its wheels. `--no-previews` asks for true RUNTIME semantics instead, and a
 * runtime that never steps physics is not one: a body is supposed to fall there.
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
    // The gate is what makes --no-previews a runtime render; a copy of the line
    // outside the `if` would silently pause there too.
    const lines = script(false).split('\n');
    const pauseLine = lines.findIndex((l) => l.includes('get_tree().paused = true'));
    expect(pauseLine).toBeGreaterThan(-1);
    expect(lines[pauseLine - 1].trim()).toBe('if PREVIEWS:');
    expect(script(false)).toContain('const PREVIEWS := false');
  });
});

/**
 * A pass that outlives its budget has to die WITH the engine it started. The
 * wrapper is the whole problem: under a display the harness's direct child is
 * `xvfb-run`, so signalling that child leaves `godot` running, reparented to
 * init, holding an X display lock that blocks the number for every later run.
 */
describe('an expired engine pass is reaped as a process group', () => {
  it('runs the display arm under the group killer, not bare xvfb-run', () => {
    const plan = godotSpawnPlan(['--path', '/tmp/work'], { display: true });
    // `timeout` is what makes the reap a GROUP reap: coreutils' `timeout.c`
    // calls `setpgid` unless `--foreground`, then signals the group on expiry.
    expect(plan.command).toBe('timeout');
    expect(plan.argv.slice(0, 3)).toEqual([
      '-k',
      String(ENGINE_KILL_AFTER_S),
      String(ENGINE_TIMEOUT_S),
    ]);
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
    // A backstop at or below the group budget would fire FIRST and signal the
    // wrapper alone — reintroducing the orphan it exists to prevent.
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
    // Ordering is load-bearing: xvfb-run's own flags must precede `godot`.
    expect(s).toBeGreaterThan(plan.argv.indexOf('xvfb-run'));
    expect(s).toBeLessThan(plan.argv.indexOf('godot'));
  });

  it('still runs the headless import arm, which has no wrapper to orphan', () => {
    const plan = godotSpawnPlan(['--headless', '--import'], { display: false });
    expect(plan.command).toBe('timeout');
    expect(plan.argv).not.toContain('xvfb-run');
    expect(plan.argv[plan.argv.indexOf('godot') + 1]).toBe('--headless');
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
 * The pause keeps the reference at the load instant for everything driven by
 * NOTIFICATION_*_PROCESS, but NOTIFICATION_DRAW is not pause-gated, so a node
 * that catches up at first draw still reads one process delta. `--fixed-fps`
 * makes that delta a constant instead of "how long this host took to reach the
 * first frame", which is the difference between a reference image that is
 * reproducible and one that is merely reproducible HERE.
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
    // The refusal outlived its first reason: the delta IS fixed now. What
    // stops a SCENE-WIDE window is the pause plus the previewer's missing hook,
    // and the message has to say so — while pointing at the per-subsystem
    // advance that does exist, or the next reader adds a flag that is already
    // there.
    const ask = () => bootstrap({ simSeconds: 0.5 });
    expect(ask).toThrow(/paused before the scene is ever instantiated/);
    expect(ask).toThrow(/--particles/);
  });
});

/**
 * EDITOR-MODE PARTICLES. The Node3D editor runs no game logic, which the pause
 * mirrors — except for particles, which it does run: `set_process_internal` is
 * called unconditionally on ENTER_TREE. `--particles <seconds>` is how a caller
 * asks for a NAMED instant of that, spent through Godot's own settle loop.
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
    // `_update_internal` zeroes `_requested_process_time` on the way past, so a
    // request placed after the first frame is spent on nothing. Both render
    // paths therefore ask immediately after the subtree enters the tree.
    for (const parent of ['\tadd_child(target)', '\tvp.add_child(target)']) {
      const at = lines.indexOf(parent);
      expect(at).toBeGreaterThan(-1);
      expect(lines[at + 1]).toBe('\t_advance_particles(target)');
    }
    expect(lines.some((l) => l.includes('request_particles_process(PARTICLES_PROCESS)'))).toBe(
      true
    );
  });

  it('advances CPUParticles only, since a GPU emitter has no pose on our side', () => {
    const body = bootstrap({ particles: 0.5 });
    expect(body).toContain('node is CPUParticles2D');
    expect(body).toContain('node is CPUParticles3D');
    expect(body).not.toContain('GPUParticles2D)');
    expect(body).not.toContain('GPUParticles3D)');
  });
});
