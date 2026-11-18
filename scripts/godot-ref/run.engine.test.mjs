/**
 * The acceptance tests of the Godot reference harness: each renders through real Godot and checks
 * the picture. `pnpm test:godot-ref` runs them, and fails on a host without `godot` or `xvfb-run`.
 * No project of the unit run includes this file. The first test holds ADR-0025: a scene with no
 * lighting of its own comes back lit by the injected preview sun and environment.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { copyFile, readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { degToRad } from '../../packages/textscene-core/src/godot/math/math.ts';
import { REPO_ROOT } from '../repoRoot.mjs';
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

  /**
   * The harness clears to the sRGB gray 0.3, whose byte is 76. An HDR root stores it linear (18),
   * and the screen blit converts it back (`renderer_compositor_rd.cpp:98`).
   */
  describe('the capture of a root viewport with rendering/viewport/hdr_2d', () => {
    // The whole path, so `engineTestInputs.mjs` finds the scene in its own folder.
    const hdrScene = join(REPO_ROOT, 'scenes/fixtures/hdr-2d/unit-hdr-2d.tscn');
    const hdrFixture = dirname(hdrScene);
    const CLEAR_PIXEL = [20, 20];
    const GRAY_AT_MODULATE_1_5_PIXEL = [500, 300];

    /** The fixture's scene in a project of its own with `hdr_2d` set to `isHdr`. */
    async function renderWithHdr(isHdr) {
      const dir = await scratchDir();
      const project = (await readFile(join(hdrFixture, 'project.godot'), 'utf8')).replace(
        'viewport/hdr_2d=true',
        `viewport/hdr_2d=${isHdr}`
      );
      await writeFile(join(dir, 'project.godot'), project);
      await copyFile(hdrScene, join(dir, 'unit-hdr-2d.tscn'));
      const out = join(dir, 'shot.png');
      await renderReference({ scene: join(dir, 'unit-hdr-2d.tscn'), out, mode: '2d-root' });
      return probePixels(await readFile(out), [CLEAR_PIXEL, GRAY_AT_MODULATE_1_5_PIXEL]);
    }

    it('is converted from linear to sRGB, as the screen shows it', async () => {
      const [clear, gray] = await renderWithHdr(true);
      // Godot's Image::linear_to_srgb table reads 75 for the stored 18 (`image.cpp:4194`), which
      // rounds before it converts. The float conversion reads 76, so the floor excludes the table.
      expect(clear.rgb[0]).toBeGreaterThanOrEqual(76);
      expect(clear.rgb[0]).toBeLessThanOrEqual(77);
      expect(gray.rgb[0]).toBeGreaterThanOrEqual(192);
      expect(gray.rgb[0]).toBeLessThanOrEqual(194);
    });

    it('is left as it is when the root is not HDR', async () => {
      const [clear, gray] = await renderWithHdr(false);
      expect(clear.rgb[0]).toBeGreaterThanOrEqual(76);
      expect(clear.rgb[0]).toBeLessThanOrEqual(77);
      // 0.5 times 1.5 multiplied as sRGB numbers, 191.
      expect(gray.rgb[0]).toBeGreaterThanOrEqual(190);
      expect(gray.rgb[0]).toBeLessThanOrEqual(192);
    });
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
  /** Each case writes a project of its own, so the project settings are the ones under test. */
  describe('--mode in-game', () => {
    const RED = [255, 0, 0];
    const GREEN = [0, 255, 0];
    const BLUE = [0, 0, 255];
    const CLEAR = [76, 76, 76];
    const PROJECT_WINDOW = [CANVAS_2D_CAPTURE.width, CANVAS_2D_CAPTURE.height];
    const CENTRE = PROJECT_WINDOW.map((side) => side / 2);

    /** The sub-resources of a text scene come first, then its root node and the children. */
    const sceneOf = ({ header = '', resources = '', root = 'Node3D', nodes = '' }) =>
      `[gd_scene format=3]\n${header}\n${resources}\n[node name="Root" type="${root}"]\n${nodes}\n`;

    /** A 2-unit box that no light or environment moves the colour of. */
    const unshadedBox = (name, x, [r, g, b]) => ({
      resources: `[sub_resource type="StandardMaterial3D" id="${name}Material"]
shading_mode = 0
albedo_color = Color(${r / 255}, ${g / 255}, ${b / 255}, 1)

[sub_resource type="BoxMesh" id="${name}Mesh"]
material = SubResource("${name}Material")
size = Vector3(2, 2, 2)
`,
      nodes: `[node name="${name}" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, 0, 0)
mesh = SubResource("${name}Mesh")
`,
    });

    /** A camera 6 units in front of the box at the same x, looking down -Z. */
    const cameraAt = (name, x, isCurrent) => `[node name="${name}" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, 0, 6)
current = ${isCurrent}
`;

    const boxScene = (boxes, nodes = '') =>
      sceneOf({
        resources: boxes.map((box) => box.resources).join('\n'),
        nodes: boxes.map((box) => box.nodes).join('\n') + nodes,
      });

    /** Renders `main.tscn` of a project that holds `files`, and reads pixels of the image. */
    async function renderProject(files, { mode = 'in-game', ...options } = {}) {
      const dir = await scratchDir();
      for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
      const out = join(dir, 'shot.png');
      const { mode: reported } = await renderReference({
        scene: join(dir, 'main.tscn'),
        out,
        mode,
        ...options,
      });
      const buffer = await readFile(out);
      const png = PNG.sync.read(buffer);
      const at = (point) => probePixels(buffer, [point])[0].rgb;
      return { png, at, reported };
    }

    const ambientRedEnvironment = `[gd_resource type="Environment" format=3]

[resource]
background_mode = 1
background_color = Color(0, 0, 0, 1)
ambient_light_source = 2
ambient_light_color = Color(1, 0, 0, 1)
`;

    it('keeps the default environment of the project, which --no-previews drops', async () => {
      const files = {
        'project.godot': `[rendering]
environment/defaults/default_environment="res://environment.tres"
`,
        'environment.tres': ambientRedEnvironment,
        'main.tscn': sceneOf({
          resources: '[sub_resource type="BoxMesh" id="1"]\nsize = Vector3(2, 2, 2)\n',
          nodes: `${cameraAt('Camera', 0, true)}
[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("1")
`,
        }),
      };
      const game = await renderProject(files);
      const runtime = await renderProject(files, { mode: '3d', previews: false });

      // The project's red ambient lights a white box red. Without it the engine's grey ambient gives no hue.
      expect(game.reported).toBe('in-game');
      expect(game.at(CENTRE)[0]).toBeGreaterThan(100);
      expect(game.at(CENTRE)[1]).toBeLessThan(10);
      const [r, g, b] = runtime.at(CENTRE);
      expect(r === g && g === b).toBe(true);
    });

    describe('looks through the camera the scene makes current', () => {
      const boxes = [unshadedBox('Left', 0, RED), unshadedBox('Right', 10, GREEN)];
      const rendered = async (firstIsCurrent, secondIsCurrent) =>
        (
          await renderProject({
            'main.tscn': boxScene(
              boxes,
              `${cameraAt('First', 0, firstIsCurrent)}\n${cameraAt('Second', 10, secondIsCurrent)}`
            ),
          })
        ).at(CENTRE);

      it('picks the first Camera3D when none is current', async () => {
        expect(await rendered(false, false)).toEqual(RED);
      });

      it('picks the last current Camera3D when two are', async () => {
        expect(await rendered(true, true)).toEqual(GREEN);
      });
    });

    it('draws only the clear colour of the project when the scene has no Camera3D', async () => {
      const { png } = await renderProject({ 'main.tscn': boxScene([unshadedBox('Box', 0, RED)]) });
      const stray = [];
      for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i] !== CLEAR[0] || png.data[i + 1] !== CLEAR[1] || png.data[i + 2] !== CLEAR[2]) {
          stray.push(i / 4);
        }
      }
      expect(stray).toEqual([]);
    });

    it('draws the 3D world and the canvas in one image', async () => {
      const canvas = `
[node name="Hud" type="CanvasLayer" parent="."]

[node name="Panel" type="ColorRect" parent="Hud"]
offset_right = 100.0
offset_bottom = 100.0
color = Color(0, 0, 1, 1)
`;
      const { at } = await renderProject({
        'main.tscn': boxScene([unshadedBox('Box', 0, RED)], `${cameraAt('Camera', 0, true)}${canvas}`),
      });
      expect(at(CENTRE)).toEqual(RED);
      expect(at([50, 50])).toEqual(BLUE);
      expect(at([PROJECT_WINDOW[0] - 8, PROJECT_WINDOW[1] - 8])).toEqual(CLEAR);
    });

    describe('runs no script', () => {
      const files = {
        'project.godot': '[autoload]\nBlue="*res://autoload.gd"\n',
        // An autoload adds a blue square, and a scene script turns a red panel green.
        'autoload.gd': `extends Node

func _ready() -> void:
	var square := ColorRect.new()
	square.color = Color(0, 0, 1)
	square.position = Vector2(200, 200)
	square.size = Vector2(100, 100)
	get_tree().root.add_child.call_deferred(square)
`,
        'scene.gd': `extends Control

func _ready() -> void:
	$Panel.color = Color(0, 1, 0)
`,
        'main.tscn': sceneOf({
          header: '[ext_resource type="Script" path="res://scene.gd" id="1"]',
          root: 'Control',
          nodes: `script = ExtResource("1")

[node name="Panel" type="ColorRect" parent="."]
offset_right = 100.0
offset_bottom = 100.0
color = Color(1, 0, 0, 1)
`,
        }),
      };
      const PANEL = [50, 50];
      const SQUARE = [250, 250];

      it('draws the authored colour and instances no autoload', async () => {
        const { at } = await renderProject(files);
        expect(at(PANEL)).toEqual(RED);
        expect(at(SQUARE)).toEqual(CLEAR);
      });

      it('differs from a run that keeps the scripts, which proves the scene would change them', async () => {
        const { at } = await renderProject(files, { mode: '2d-root', previews: false });
        expect(at(PANEL)).toEqual(GREEN);
        expect(at(SQUARE)).toEqual(BLUE);
      });
    });

    it('advances a 3D emitter by the seconds `particles` names, before the paused tree can spend them', async () => {
      const emitter = `[gd_scene format=3]

[sub_resource type="SphereMesh" id="Dot"]
radius = 0.1
height = 0.2

[node name="Root" type="Node3D"]

[node name="Camera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 6)

[node name="Emitter" type="CPUParticles3D" parent="."]
amount = 40
lifetime = 1.25
mesh = SubResource("Dot")
direction = Vector3(0, 0, 1)
gravity = Vector3(0, 0, 0)
initial_velocity_min = 1.0
initial_velocity_max = 1.0
`;
      const unadvanced = await renderProject({ 'main.tscn': emitter }, { particles: 0 });
      const advanced = await renderProject({ 'main.tscn': emitter }, { particles: 1.25 });
      expect(Buffer.from(advanced.png.data).equals(Buffer.from(unadvanced.png.data))).toBe(false);
    });

    describe('renders the root window at the size the project sets', () => {
      const display = (lines) => `[display]\n${lines.join('\n')}\n`;
      const main = boxScene([unshadedBox('Box', 0, RED)], cameraAt('Camera', 0, true));

      it('is 1152 x 648 for a scene with no project.godot', async () => {
        const { png } = await renderProject({ 'main.tscn': main });
        expect([png.width, png.height]).toEqual(PROJECT_WINDOW);
      });

      it('is the window override, with the stretch mode of the project in effect', async () => {
        const { png } = await renderProject({
          'project.godot': display([
            'window/size/viewport_width=400',
            'window/size/viewport_height=300',
            'window/size/window_width_override=800',
            'window/size/window_height_override=600',
            'window/stretch/mode="canvas_items"',
          ]),
          'main.tscn': main,
        });
        expect([png.width, png.height]).toEqual([800, 600]);
      });

      it('takes an override on one axis alone, as each axis is read on its own (main.cpp:2635-2644)', async () => {
        const { png } = await renderProject({
          'project.godot': display([
            'window/size/viewport_width=400',
            'window/size/viewport_height=300',
            'window/size/window_width_override=800',
            'window/stretch/mode="canvas_items"',
          ]),
          'main.tscn': main,
        });
        expect([png.width, png.height]).toEqual([800, 300]);
      });

      it('fills the window outside the kept aspect with black bars', async () => {
        const { png, at } = await renderProject({
          'project.godot': display([
            'window/size/viewport_width=400',
            'window/size/viewport_height=300',
            'window/size/window_width_override=800',
            'window/size/window_height_override=800',
            'window/stretch/mode="canvas_items"',
          ]),
          'main.tscn': main,
        });
        expect([png.width, png.height]).toEqual([800, 800]);
        expect([at([400, 50]), at([400, 400]), at([400, 750])]).toEqual([[0, 0, 0], RED, [0, 0, 0]]);
      });

      it('is the window under the viewport stretch mode, which scales the viewport at the blit', async () => {
        const { png } = await renderProject({
          'project.godot': display([
            'window/size/viewport_width=400',
            'window/size/viewport_height=300',
            'window/size/window_width_override=800',
            'window/size/window_height_override=600',
            'window/stretch/mode="viewport"',
          ]),
          'main.tscn': main,
        });
        expect([png.width, png.height]).toEqual([800, 600]);
      });
    });
  });
});
