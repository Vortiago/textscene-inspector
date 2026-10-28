/**
 * Where a DirectionalLight2D's shadow is measured from: the light's own +Y axis
 * (`renderer_viewport.cpp:564`, "Y is light direction") and the game viewport it renders into,
 * and how the editor camera reaches the map. These drive the real R3F loop.
 */

import { describe, it, expect } from 'vitest';
import { useState, type ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { useDirectionalShadow, type DirectionalShadowSampler } from './directionalShadowView';
import { buildDirectionalShadowMap, type DirectionalShadowView } from './directionalShadowMap';
import { CanvasLighting2DProvider } from './CanvasLighting2D';
import { CanvasLightPass } from './CanvasLightPass';
import { fakeLightPassHost } from './testing/fakeLightPassHost';
import type { CanvasClip, LightPassHost } from './lightPassHost';
import type { Quad2, ShadowCasterEdges } from './shadowVolumes';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** An occluder box 100 by 60 px, from its lower-left corner. */
function box(x: number, y: number): ShadowCasterEdges {
  const [x1, y1] = [x + 100, y + 60];
  return {
    segments: [x, y, x1, y, x1, y, x1, y1, x1, y1, x, y1, x, y1, x, y],
    cullMode: 0,
    bounds: [
      { x, y },
      { x: x1, y },
      { x: x1, y: y1 },
      { x, y: y1 },
    ],
  };
}

// One box below the origin, where the stage and the default host look, and one above it, where the
// square host looks, so every canvas in these tests has an occluder in view.
const CASTERS = [box(400, -400), box(400, 400)];

function clipOf(x: number, y: number, w: number, h: number, scale = { x: 1, y: 1 }): CanvasClip {
  return { rect: { x, y, w, h }, scale };
}

function quadOf({ x, y, w, h }: CanvasClip['rect']): Quad2 {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** The depths a map over `view` stores, which a sampler for the same view must have written. */
function binsOver(clip: CanvasClip, direction: { x: number; y: number }, maxDistance = 0) {
  const view: DirectionalShadowView = {
    clip: quadOf(clip.rect),
    direction,
    maxDistance,
    scale: clip.scale,
  };
  return Array.from(buildDirectionalShadowMap(view, CASTERS).bins);
}

const binsOf = (sampler: DirectionalShadowSampler) => Array.from(sampler.map.image.data as Float32Array);

/** The light node in the tree, and the sampler its hook returned. */
function SamplerHarness({
  onSampler,
  godotRotation = 0,
  maxDistance = 0,
  casters = CASTERS,
}: {
  onSampler: (sampler: DirectionalShadowSampler) => void;
  godotRotation?: number;
  maxDistance?: number;
  casters?: readonly ShadowCasterEdges[];
}) {
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);
  onSampler(useDirectionalShadow(anchor, casters, maxDistance));
  // The previewer conjugates the 2D tree by diag(1, -1), which negates a rotation.
  return <group ref={setAnchor} rotation={[0, 0, -godotRotation]} />;
}

type HarnessProps = Omit<Parameters<typeof SamplerHarness>[0], 'onSampler'>;

/** The pass the 2D stage mounts, which the hook reads the canvas from. */
function stage(children: ReactNode) {
  return <CanvasLighting2DProvider canvasModulate={WHITE}>{children}</CanvasLighting2DProvider>;
}

async function mountOnStage(props: HarnessProps = {}) {
  let sampler!: DirectionalShadowSampler;
  await ReactThreeTestRenderer.create(stage(<SamplerHarness onSampler={(s) => (sampler = s)} {...props} />));
  await ReactThreeTestRenderer.act(async () => {});
  return sampler;
}

async function mountOver(host: LightPassHost, props: HarnessProps = {}) {
  let sampler!: DirectionalShadowSampler;
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasLightPass host={host} canvasModulate={WHITE}>
      <SamplerHarness onSampler={(s) => (sampler = s)} {...props} />
    </CanvasLightPass>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, sampler };
}

/** The canvas of the 2D stage: Godot's default project viewport at the origin. */
const STAGE_CLIP = clipOf(0, -648, 1152, 648);
const DOWN = { x: 0, y: -1 };

describe('useDirectionalShadow, in the map it builds', () => {
  it('sends an unrotated light down the screen, Godot +Y', async () => {
    const expected = binsOver(STAGE_CLIP, DOWN);
    expect(expected).not.toEqual(binsOver(STAGE_CLIP, { x: 1, y: 0 }));
    expect(binsOf(await mountOnStage())).toEqual(expected);
  });

  it('turns the light with its rotation, clockwise on screen for a positive one', async () => {
    // Godot 4.6.3 at rotation 0.5 shadows down and to the left of the occluder.
    const expected = binsOver(STAGE_CLIP, { x: -Math.sin(0.5), y: -Math.cos(0.5) });
    expect(expected).not.toEqual(binsOver(STAGE_CLIP, DOWN));
    expect(binsOf(await mountOnStage({ godotRotation: 0.5 }))).toEqual(expected);
  });

  it("clips to Godot's default project viewport at the canvas origin", async () => {
    const shifted = clipOf(100, -648, 1152, 648);
    const expected = binsOver(STAGE_CLIP, DOWN);
    expect(expected).not.toEqual(binsOver(shifted, DOWN));
    expect(binsOf(await mountOnStage())).toEqual(expected);
  });

  it('keeps max_distance in canvas pixels', async () => {
    const expected = binsOver(STAGE_CLIP, DOWN, 100);
    expect(expected).not.toEqual(binsOver(STAGE_CLIP, DOWN));
    expect(binsOf(await mountOnStage({ maxDistance: 100 }))).toEqual(expected);
  });

  it('writes nothing without an occluder', async () => {
    const sampler = await mountOnStage({ casters: [] });
    expect(sampler.map.version).toBe(0);
    expect(sampler.ndcToShadow.equals(new THREE.Matrix3())).toBe(true);
  });

  describe('over a host that frames its own canvas', () => {
    it("clips to the host's clip, as a SubViewport's Camera2D moves it", async () => {
      const host = fakeLightPassHost(1000, 1000);
      host.clip = clipOf(300, -700, 200, 100);
      const expected = binsOver(host.clip, DOWN);
      expect(expected).not.toEqual(binsOver(STAGE_CLIP, DOWN));
      expect(binsOf((await mountOver(host)).sampler)).toEqual(expected);
    });

    it("carries the host's scale, which a Camera2D zoom sets", async () => {
      const host = fakeLightPassHost(1000, 1000);
      host.clip = clipOf(0, -1000, 1000, 1000, { x: 2, y: 3 });
      const expected = binsOver(host.clip, DOWN);
      expect(expected).not.toEqual(binsOver(clipOf(0, -1000, 1000, 1000), DOWN));
      expect(binsOf((await mountOver(host)).sampler)).toEqual(expected);
    });

    it("follows the host's clip on the next run of its pass, before any React render", async () => {
      const host = fakeLightPassHost(1000, 1000);
      const { sampler } = await mountOver(host);
      host.clip = clipOf(100, -900, 1000, 1000);
      host.run.current!();
      expect(binsOf(sampler)).toEqual(binsOver(host.clip, DOWN));
    });

    it('builds the map only when the clip, the light or the occluders change', async () => {
      const host = fakeLightPassHost(1000, 1000);
      const { sampler } = await mountOver(host);
      const written = sampler.map.version;
      for (let frame = 0; frame < 5; frame += 1) host.run.current!();
      expect(sampler.map.version).toBe(written);
    });

    it('builds the map again for new occluders', async () => {
      const host = fakeLightPassHost(1000, 1000);
      let sampler!: DirectionalShadowSampler;
      const mount = (casters: readonly ShadowCasterEdges[]) => (
        <CanvasLightPass host={host} canvasModulate={WHITE}>
          <SamplerHarness onSampler={(s) => (sampler = s)} casters={casters} />
        </CanvasLightPass>
      );
      const renderer = await ReactThreeTestRenderer.create(mount(CASTERS));
      await ReactThreeTestRenderer.act(async () => {});
      const before = binsOf(sampler);
      await renderer.update(mount([box(100, -200)]));
      expect(binsOf(sampler)).not.toEqual(before);
    });
  });
});

/** An orthographic camera showing the square exactly: x 0..1000, y 0..1000. */
function squareHost(): ReturnType<typeof fakeLightPassHost> {
  const host = fakeLightPassHost(1000, 1000);
  host.clip = clipOf(0, 0, 1000, 1000);
  host.camera.position.set(500, 500, 10);
  host.camera.updateProjectionMatrix();
  return host;
}

/** `(u, depth)` at an NDC point through `matrix`. */
function lookup(matrix: THREE.Matrix3, x: number, y: number): [number, number] {
  const point = new THREE.Vector3(x, y, 1).applyMatrix3(matrix);
  return [point.x, point.y];
}

describe('useDirectionalShadow, in the lookup it writes', () => {
  it("maps the host camera's NDC onto the map: NDC (0, 0.2) is world (500, 600), 400 px deep", async () => {
    const { sampler } = await mountOver(squareHost());
    const [u, depth] = lookup(sampler.ndcToShadow, 0, 0.2);
    expect(u).toBeCloseTo(0.5, 9);
    expect(depth).toBeCloseTo(0.4, 9);
  });

  it('follows a pan on the next run in the same matrix', async () => {
    const host = squareHost();
    const { sampler } = await mountOver(host);
    const { ndcToShadow } = sampler;
    host.camera.position.x += 100;
    host.run.current!();
    // NDC 0 is now world x 600, 100 px right of the centre over the 1414.2 px diagonal.
    expect(lookup(ndcToShadow, 0, 0)[0]).toBeCloseTo(0.5 + 100 / (1000 * Math.SQRT2), 9);
    expect(sampler.ndcToShadow).toBe(ndcToShadow);
  });

  it('describes the same frame as the map when both the clip and the camera move', async () => {
    const host = squareHost();
    const { sampler } = await mountOver(host);
    host.clip = clipOf(100, 0, 1000, 1000);
    host.camera.position.x += 100;
    host.run.current!();
    expect(binsOf(sampler)).toEqual(binsOver(host.clip, DOWN));
    // The map spans world x 100..1100, so NDC 0 at world x 600 is its centre.
    expect(lookup(sampler.ndcToShadow, 0, 0)[0]).toBeCloseTo(0.5, 9);
  });
});
