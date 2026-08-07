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
  FRAME_MARGIN,
  PARTICLES_PROCESS_DEFAULT,
  parseArgs,
  REFERENCE_FIXED_FPS,
  renderArgv,
  resolveProjectRoot,
  projectConfig,
  probePixels,
  renderReference,
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
