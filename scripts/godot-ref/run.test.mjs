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
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import {
  EDITOR_CAMERA_DIRECTION,
  EDITOR_CAMERA_DISTANCE,
  EDITOR_FOV,
  FRAME_MARGIN,
  parseArgs,
  resolveProjectRoot,
  projectConfig,
  probePixels,
  renderReference,
} from './run.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

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
});

describe('parseArgs', () => {
  it('takes the scene as the sole positional argument', () => {
    expect(parseArgs(['scenes/fixtures/unit-plane-mesh.tscn']).scene).toBe(
      'scenes/fixtures/unit-plane-mesh.tscn'
    );
  });

  it('defaults the viewport to 400x300 and previews to on', () => {
    const args = parseArgs(['a.tscn']);
    expect(args.width).toBe(400);
    expect(args.height).toBe(300);
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
  const scene = join(import.meta.dirname, 'scenes', 'preview-lighting.tscn');
  const SKY = [200, 8];
  const GROUND = [200, 292];

  async function render(previews) {
    const out = join(await mkdtemp(join(tmpdir(), 'godot-ref-')), 'shot.png');
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
    const dir = await mkdtemp(join(tmpdir(), 'godot-ref-'));
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

  it('lights the scene only because of the previews — --no-previews is runtime semantics', async () => {
    const [lit, unlit] = [await render(true), await render(false)];
    // The same geometry, the same camera. With the previews the ground is a
    // brightly lit plane; without them it is an unlit silhouette, which is
    // what `godot --path` (the running game) actually shows.
    expect(Math.max(...lit.ground)).toBeGreaterThan(3 * Math.max(...unlit.ground));
    expect(Math.max(...unlit.ground)).toBeLessThan(80);
  }, 360_000);
});
