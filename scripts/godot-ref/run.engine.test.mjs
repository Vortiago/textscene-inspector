/**
 * The acceptance tests of the Godot reference harness: each renders through real Godot and checks
 * the picture. `pnpm test:godot-ref` runs them, and fails on a host without `godot` or `xvfb-run`.
 * No project of the unit run includes this file. The first test holds ADR-0025: a scene with no
 * lighting of its own comes back lit by the injected preview sun and environment.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { degToRad } from '../../packages/textscene-core/src/godot/math/math.ts';
import { CANVAS_2D_CAPTURE } from '../visual/preview/appContract.mjs';
import {
  EDITOR_CAMERA_DIRECTION,
  EDITOR_FOV,
  ENGINE_KILL_AFTER_S,
  ENGINE_TIMEOUT_S,
  FRAME_MARGIN,
  probePixels,
  renderReference,
} from './run.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

/**
 * A test's budget: a render runs two engine passes, an import and the draw, and a test may render
 * twice. Each pass is reaped after `ENGINE_TIMEOUT_S`, so the harness names an overrun itself. A
 * smaller budget ends a slow render as an anonymous vitest timeout: 24 renders at once on 4 cores
 * take about 420 s each.
 */
const ENGINE_TEST_TIMEOUT_MS = 2 * 2 * (ENGINE_TIMEOUT_S + ENGINE_KILL_AFTER_S) * 1000;

describe('renderReference (real Godot)', { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  // On a tmpfs /tmp each render's output stays in RAM after every suite run.
  const scratch = [];
  /**
   * Per channel, not a mean: a mean under 1 passes with thousands of channels off by 200. The two
   * PNGs must be the same size.
   */
  const worstChannelDelta = async (pathA, pathB) => {
    const a = PNG.sync.read(await readFile(pathA)).data;
    const b = PNG.sync.read(await readFile(pathB)).data;
    expect(b.length).toBe(a.length);
    let worst = 0;
    for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
    return worst;
  };
  /** The rasteriser's 1/255 blend-rounding floor. */
  const ROUNDING_FLOOR = 1;

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
    // Godot's preview sky above the horizon is blue-grey: blue dominates, and it is far brighter
    // than the flat default clear colour a runtime render leaves there.
    expect(sky[2]).toBeGreaterThan(sky[0]);
    expect(Math.max(...sky)).toBeGreaterThan(120);
  });

  /**
   * A paused 3D emitter spends a request only in `_update_internal`, which the enter-tree
   * notification calls once, so the request has to reach the node before it enters the tree
   * (`cpu_particles_3d.cpp:586`, `:1354`). Asked afterwards, the reference draws no particles.
   */
  it('draws a 3D emitter at the seconds `particles` names', async () => {
    const dir = await scratchDir();
    const emitterScene = join(import.meta.dirname, 'scenes', 'cpuparticles3d-unpreprocessed.tscn');
    const renderAt = async (particles) => {
      const out = join(dir, `emitter-${particles}.png`);
      await renderReference({ scene: emitterScene, out, width: 200, height: 150, particles });
      return readFile(out);
    };
    const unadvanced = await renderAt(0);
    const advanced = await renderAt(1.25);
    expect(advanced.equals(unadvanced)).toBe(false);
  });

  /**
   * `--emit-bounds` lets both renderers derive one camera, so it measures what the previewer
   * frames on: `frameSceneBounds.ts` unions meshes, and gizmos only when a scene has none. A
   * Light3D is a VisualInstance3D too, and a union of every visual moves the look-at towards it.
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
    // Geometry first, as in frameSceneBounds.ts. This fixture's sun sits 5 units above an 8x8
    // plane, so a union of every visual puts the centre at y=3 instead of y=0.
    expect(b.position[1]).toBeCloseTo(0, 3);
    expect(b.size[1]).toBeLessThan(0.5);
    expect(b.size[0]).toBeCloseTo(8, 3);
    expect(b.size[2]).toBeCloseTo(8, 3);
  });

  /**
   * The reference shows the authored pose: `_converge()` steps six process frames, through which a
   * live RigidBody3D falls, and the previewer never runs physics. The crate's 1x1 box is centred
   * at y=1, so its AABB floor sits at y=0.5, and a crate that fell reports a lower floor.
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
    expect(b.position[1], `bounds ${JSON.stringify(b)}`).toBeCloseTo(0.5, 1);
    expect(b.size[1], `bounds ${JSON.stringify(b)}`).toBeCloseTo(1, 1);
  });

  /**
   * SoftBody3D has no freeze property, and its `get_aabb` reports the rest AABB while the cloth
   * falls, so the harness disables the node and this test measures the render. At rest the 2×2
   * plane fills the framed centre. Unfrozen, it falls out within a few settle frames and leaves the
   * dark preview-environment ground there.
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
    const [centre] = probePixels(buffer, [[Math.floor(png.width / 2), Math.floor(png.height / 2)]], {
      patch: 15,
    });
    expect(Math.min(...centre.rgb)).toBeGreaterThan(150);
  });

  /** A box face of a KEEP_ACTIVE SoftBody3D keeps one flat shade: the reason is in `_freeze_game_logic`. */
  it('keeps a KEEP_ACTIVE SoftBody3D on its authored flat normals, as the editor draws it', async () => {
    const out = join(await scratchDir(), 'shot.png');
    await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-soft-body-3d.tscn'),
      out,
      mode: '3d',
    });
    const [upperLeft, lowerRight] = probePixels(
      await readFile(out),
      [
        [395, 200],
        [450, 300],
      ],
      { patch: 5 }
    );
    // Within 2/255: a flat face still drifts by a step across its width. Smoothing moved it by 22.
    for (const channel of [0, 1, 2]) {
      expect(Math.abs(lowerRight.rgb[channel] - upperLeft.rgb[channel])).toBeLessThanOrEqual(2);
    }
  });

  /**
   * `--frame` places its camera from the bounds `--emit-bounds` reports. A CSG shape sets
   * `node_aabb` only in a deferred `update_shape()` (`modules/csg/csg_shape.cpp:221-226`, `:507`),
   * so a camera placed right after `add_child()` sees an empty box for every CSG node and frames
   * the union of their origins.
   */
  it('places --frame’s camera from the same bounds --emit-bounds reports, for CSG', async () => {
    const dir = await scratchDir();
    const scene = join(REPO_ROOT, 'scenes/fixtures/unit-csg-transparency.tscn');
    const framed = join(dir, 'framed.png');
    const boundsOut = join(dir, 'framed.bounds.json');
    await renderReference({ scene, out: framed, boundsOut, width: 160, height: 120, frame: true });

    // The same derivation `_place_camera` performs, from the emitted bounds.
    const b = JSON.parse(await readFile(boundsOut, 'utf8'));
    const span = Math.max(...b.size);
    const distance = (span / 2 / Math.tan(degToRad(EDITOR_FOV / 2))) * FRAME_MARGIN;
    const focus = b.position.map((p, i) => p + b.size[i] / 2);
    const derived = join(dir, 'derived.png');
    await renderReference({
      scene,
      out: derived,
      width: 160,
      height: 120,
      camera: focus.map((f, i) => f + EDITOR_CAMERA_DIRECTION[i] * distance),
      lookAt: focus,
    });

    expect(await worstChannelDelta(framed, derived)).toBeLessThanOrEqual(ROUNDING_FLOOR);
  });

  /**
   * A CPUParticles3D reports an empty AABB and a Label3D only its position before its text shapes,
   * so the bounds are a point. `frameSceneBounds.ts` keeps the editor camera's distance for a point
   * and re-points at it. A scene framed on a point at the origin therefore equals the unframed
   * editor camera, and a distance of 0 would put the camera inside the point, looking at the sky.
   */
  it.each([
    // The particles are saturated yellow; the sky and ground are near grey.
    [
      'a CPUParticles3D',
      'unit-cpuparticles3d-row.tscn',
      (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 100,
    ],
    // The text is white; the brightest sky is about 205.
    [
      'a Label3D',
      'label3d-glyph-mipmaps/unit-label3d-glyph-mipmaps.tscn',
      (r, g, b) => Math.min(r, g, b) > 245,
    ],
  ])(
    'frames %s, whose bounds are a point at the origin, at the editor camera distance',
    async (_, fixture, isContent) => {
      const dir = await scratchDir();
      const scene = join(REPO_ROOT, 'scenes/fixtures', fixture);
      const framed = join(dir, 'framed.png');
      const editor = join(dir, 'editor.png');
      await renderReference({ scene, out: framed, width: 160, height: 120, frame: true });
      await renderReference({ scene, out: editor, width: 160, height: 120 });

      // Two empty skies would also be equal, so the frame must hold the content itself.
      const { data } = PNG.sync.read(await readFile(framed));
      let contentPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (isContent(data[i], data[i + 1], data[i + 2])) contentPixels++;
      }
      expect(contentPixels).toBeGreaterThan(0);
      expect(await worstChannelDelta(framed, editor)).toBeLessThanOrEqual(ROUNDING_FLOOR);
    }
  );

  /**
   * The 2D path end to end: a Node2D scene comes back as the project-viewport rectangle that the
   * previewer's 2D stage draws, with no 3D camera. The 3D path would return it at the wrong size,
   * over a sky.
   */
  it('renders a 2D scene as the project viewport, cleared to the clear colour', async () => {
    const out = join(await scratchDir(), 'canvas.png');
    const { mode } = await renderReference({
      scene: join(REPO_ROOT, 'scenes/fixtures/unit-line2d.tscn'),
      out,
    });
    expect(mode).toBe('2d');
    const buffer = await readFile(out);
    const png = PNG.sync.read(buffer);
    expect([png.width, png.height]).toEqual([CANVAS_2D_CAPTURE.width, CANVAS_2D_CAPTURE.height]);

    // Bottom-right corner: empty canvas, so the clear colour. Vulkan lands sRGB 0.3 on byte 76,
    // where 0.3 x 255 is 76.5 and opengl3 gives 77.
    const [corner] = probePixels(buffer, [[png.width - 8, png.height - 8]], { patch: 5 });
    expect(corner.rgb).toEqual([76, 76, 76]);
    // The fixture's white line runs through the upper left, far brighter than the background.
    const [line] = probePixels(buffer, [[150, 150]], { patch: 21 });
    expect(Math.min(...line.rgb)).toBeGreaterThan(150);
  });

  /**
   * The scene draws a four-deep chain of half-pixel Control offsets directly and inside its own
   * SubViewport, with `gui/common/snap_controls_to_pixels` off. Only the root window's own scene
   * is unsnapped, and the nested chain is the control. The offsets add to 2 px on whole pixels,
   * so no fill rule enters, and `patch: 1` keeps a median from straddling the 2 px measured.
   */
  const snapScene = join(REPO_ROOT, 'scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn');
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

    const [unsnapped, snapped, nested] = probePixels(buffer, [UNSNAPPED_ONLY, SNAPPED_ONLY, NESTED_ARM], {
      patch: 1,
    });
    expect(unsnapped.rgb).toEqual(GREEN);
    expect(snapped.rgb).toEqual(BACKDROP);
    // The nested arm is inside a SubViewport in BOTH modes, so it must not move.
    expect(nested.rgb).toEqual(GREEN);
  });

  it('refuses the SubViewport capture for that project instead of answering with the default', async () => {
    const out = join(await scratchDir(), 'nested.png');
    await expect(renderReference({ scene: snapScene, out, mode: '2d' })).rejects.toThrow(
      /gui\/common\/snap_controls_to_pixels/
    );
    await expect(renderReference({ scene: snapScene, out, mode: '2d' })).rejects.toThrow(/--mode 2d-root/);
  });

  /** A calibration scene from `scenes/`, rendered at 160x120, as PNG bytes. */
  async function renderCalibrationScene(file, options) {
    const out = join(await scratchDir(), 'calibration.png');
    await renderReference({
      scene: join(import.meta.dirname, 'scenes', file),
      out,
      width: 160,
      height: 120,
      ...options,
    });
    return readFile(out);
  }

  const channelsOf = async (file, options) => PNG.sync.read(await renderCalibrationScene(file, options)).data;

  /**
   * Volumetric fog with temporal reprojection mixes 0.9 of a history that starts black
   * (`volumetric_fog_process.glsl:683`, `fog.cpp:482`), so six frames leave it dark by 0.9^6.
   * A converged capture shows the fog a running game shows, which reprojection off draws at once.
   */
  it('captures volumetric fog once its temporal history has converged', async () => {
    const options = { previews: false, camera: [0, 2.5, 6], lookAt: [0, 1.5, 0] };
    const blended = await channelsOf('volumetric-fog-history-on.tscn', options);
    const direct = await channelsOf('volumetric-fog-history-off.tscn', options);

    const largestGap = blended.reduce((gap, value, i) => Math.max(gap, Math.abs(value - direct[i])), 0);
    expect(largestGap).toBeLessThanOrEqual(1);
  });

  /**
   * While a material's pipeline compiles, Godot draws the ubershader (`render_forward_clustered.cpp:509-514`),
   * which culls by `gl_FrontFacing`, true for a point (`scene_forward_clustered.glsl:3010-3016`). A
   * cull-front point is missing from a capture that does not wait for the pipeline to land.
   */
  it('captures a cull-front point once its pipeline has landed', async () => {
    const options = { previews: true, camera: [0, 0, 3], lookAt: [0, 0, 0] };
    const front = await channelsOf('point-cull-front.tscn', options);
    const back = await channelsOf('point-cull-back.tscn', options);

    const centre = (120 / 2) * 160 * 4 + (160 / 2) * 4;
    expect(front[centre + 1]).toBeGreaterThan(200);
    expect(front.every((value, i) => Math.abs(value - back[i]) <= 1)).toBe(true);
  });

  /**
   * An UPDATE_ONCE ReflectionProbe captures over several frames, and the scene renders one such
   * probe at a time (`renderer_scene_cull.cpp:3739-3751`), so six frames leave a probe empty. A
   * capture that waits them out shows what UPDATE_ALWAYS shows at once. The two filter the
   * roughness layers differently (`renderer_rd/storage_rd/light_storage.cpp:1655,1661`), so a few
   * texels differ.
   */
  it('captures every ReflectionProbe that updates once before it saves the frame', async () => {
    const options = { camera: [0, 2.5, 6], lookAt: [0, 0.5, 0] };
    const once = await channelsOf('reflection-probe-capture-once.tscn', options);
    const always = await channelsOf('reflection-probe-capture-always.tscn', options);

    const colourChannels = (once.length / 4) * 3;
    const farOff = once.filter((value, i) => i % 4 !== 3 && Math.abs(value - always[i]) > 4).length;
    expect(farOff / colourChannels).toBeLessThan(0.01);
  });

  /**
   * The editor keeps the edited scene under its 2D viewport (`editor_node.cpp:8648-8652`), so the
   * 3D editor viewport draws no CanvasItem, in a CanvasLayer or not. A running game draws both.
   */
  it('draws no 2D over a 3D scene under the previews', async () => {
    const covers = async (previews) => {
      const png = await renderCalibrationScene('2d-over-3d.tscn', { previews });
      return probePixels(png, [
        [40, 60],
        [120, 60],
      ]).map((pixel) => pixel.rgb);
    };
    const MAGENTA = [255, 0, 255];

    for (const rgb of await covers(true)) expect(rgb).not.toEqual(MAGENTA);
    expect(await covers(false)).toEqual([MAGENTA, MAGENTA]);
  });

  it('lights the scene only because of the previews — --no-previews is runtime semantics', async () => {
    const [lit, unlit] = [await render(true), await render(false)];
    // The same geometry and camera. With the previews the ground is lit. Without them it is the
    // unlit silhouette that `godot --path` (the running game) shows.
    expect(Math.max(...lit.ground)).toBeGreaterThan(3 * Math.max(...unlit.ground));
    expect(Math.max(...unlit.ground)).toBeLessThan(80);
  });
});
