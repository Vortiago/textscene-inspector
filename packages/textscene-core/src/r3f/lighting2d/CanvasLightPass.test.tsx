/**
 * A light pass runs on the host that mounts it: through the host's scene and camera, into buffers
 * of the host's size, when the host calls `run`. The 2D stage and each SubViewport are such hosts.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLightPass } from './CanvasLightPass';
import { useCanvasLighting2D, type CanvasLighting2D } from './lightPassContext';
import { useRegisterCanvasLight2D, useRegisterLitItem, usePassMeshRef } from './lightPassDeclarations';
import { DEFAULT_LIGHT_CULL_KEY } from './lightCullKey';
import { placementId } from './itemLightList';
import { fakeLightPassHost } from './testing/fakeLightPassHost';
import type { LightPassHost } from './lightPassHost';
import { useCanvasModulate } from '../canvasModulate';
import type { Rgba } from '../../godot/math/math';
import { settleLoads } from '../testing/settleLoads';
import { withStubbedGl } from '../testing/stubbedGl';
import { canvasColorSpaceOf, type CanvasColorSpace } from '../canvasColorSpace';
import { renderLightLists } from './lightAccumulationPass';

vi.mock('./lightAccumulationPass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lightAccumulationPass')>();
  return { ...actual, renderLightLists: vi.fn(actual.renderLightLists) };
});

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

interface Seen {
  gl?: THREE.WebGLRenderer;
  lighting?: CanvasLighting2D;
}

const PLACEMENT = { lightMask: 1, z: 0, layer: 0, takenLights: null };

/** A lamp the pass draws, and an item that reads it. */
function Scene({ seen, normalMapped = false }: { seen: Seen; normalMapped?: boolean }) {
  seen.gl = useThree((state) => state.gl);
  seen.lighting = useCanvasLighting2D();
  const ordinal = useRegisterCanvasLight2D(true, {
    reach: DEFAULT_LIGHT_CULL_KEY,
    sequence: 0,
    shadowItemCullMask: null,
    tintsShadow: false,
    mixes: false,
  });
  const meshRef = usePassMeshRef<THREE.Mesh>(ordinal, 'lit');
  useRegisterLitItem(PLACEMENT, normalMapped ? 'apart' : 'plain');
  return <mesh ref={meshRef} />;
}

interface Draw {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly size: [number, number];
}

async function mount(host: LightPassHost, normalMapped = false) {
  const seen: Seen = {};
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasLightPass space={canvasColorSpaceOf(false)} host={host} canvasModulate={WHITE}>
      <Scene seen={seen} normalMapped={normalMapped} />
    </CanvasLightPass>
  );
  await settleLoads();
  return { renderer, seen };
}

/** Records each accumulation draw while `act` runs, without a GPU. */
async function drawsDuring(gl: THREE.WebGLRenderer, act: () => void | Promise<void>): Promise<Draw[]> {
  const draws: Draw[] = [];
  await withStubbedGl(
    gl,
    {
      onRender: (bound, scene, camera) => {
        if (bound) draws.push({ scene, camera, size: [bound.width, bound.height] });
      },
    },
    act
  );
  return draws;
}

describe('CanvasLightPass', () => {
  it("accumulates through the host's scene and camera when the host runs it", async () => {
    const host = fakeLightPassHost(300, 200);
    const { seen } = await mount(host);
    const draws = await drawsDuring(seen.gl!, () => host.run.current!());
    expect(draws.length).toBeGreaterThan(0);
    expect(draws.every((draw) => draw.scene === host.scene && draw.camera === host.camera)).toBe(true);
  });

  it("sizes every accumulation buffer to the host's buffer size", async () => {
    const host = fakeLightPassHost(300, 200);
    const { seen } = await mount(host);
    const draws = await drawsDuring(seen.gl!, () => host.run.current!());
    expect(new Set(draws.map((draw) => draw.size.join('x')))).toEqual(new Set(['300x200']));
  });

  it("publishes the host's buffer size as the resolution lit items read at gl_FragCoord", async () => {
    const host = fakeLightPassHost(300, 200);
    const { seen } = await mount(host);
    await drawsDuring(seen.gl!, () => host.run.current!());
    expect(seen.lighting!.resolution.toArray()).toEqual([300, 200]);
  });

  it('keeps no light apart while no normal-mapped item reads the list', async () => {
    const { seen } = await mount(fakeLightPassHost(300, 200));
    expect(seen.lighting!.lists.get(placementId(PLACEMENT))!.apart).toBeNull();
  });

  it('publishes a layer, a place and a mode per light for a normal-mapped item', async () => {
    const { seen } = await mount(fakeLightPassHost(300, 200), true);
    const { apart } = seen.lighting!.lists.get(placementId(PLACEMENT))!;
    expect(apart!.buffer).toBeInstanceOf(THREE.DataArrayTexture);
    expect(apart!.places).toHaveLength(1);
    // A positional light, not MIX, that adds no `shadow_color`.
    expect(apart!.modes.map((mode) => mode.toArray())).toEqual([[0, 0, -1]]);
  });

  it('draws only the layers while only a normal-mapped item reads the list', async () => {
    const host = fakeLightPassHost(300, 200);
    const { seen } = await mount(host, true);
    const draws = await drawsDuring(seen.gl!, () => host.run.current!());
    expect(draws.map((draw) => draw.size.join('x'))).toEqual(['300x200']);
    expect(seen.lighting!.lists.get(placementId(PLACEMENT))!.buffer).toBeNull();
  });

  it("asks the light's placer where it sits ahead of the draws", async () => {
    const host = fakeLightPassHost(300, 200);
    const { seen } = await mount(host, true);
    seen.lighting!.registerApartPlacer(0, (place) => place.set(1, 2, 3));
    await drawsDuring(seen.gl!, () => host.run.current!());
    const { apart } = seen.lighting!.lists.get(placementId(PLACEMENT))!;
    expect(apart!.places[0]!.toArray()).toEqual([1, 2, 3]);
  });

  it('draws nothing on a frame the host does not run it', async () => {
    const host = fakeLightPassHost(300, 200);
    const { renderer, seen } = await mount(host);
    const draws = await drawsDuring(seen.gl!, () => {
      renderer.advanceFrames(3, 1 / 60);
    });
    expect(draws).toEqual([]);
  });

  it('withdraws its run from the host on unmount', async () => {
    const host = fakeLightPassHost(300, 200);
    const { renderer } = await mount(host);
    expect(host.run.current).not.toBeNull();
    await renderer.unmount();
    expect(host.run.current).toBeNull();
  });

  it('publishes its canvas modulate to the items inside, whatever canvas surrounds the pass', async () => {
    const night: Rgba = { r: 0.2, g: 0.3, b: 0.6, a: 1 };
    let seen: Rgba | undefined;
    function ReadModulate() {
      seen = useCanvasModulate();
      return null;
    }
    await ReactThreeTestRenderer.create(
      <CanvasLightPass
        space={canvasColorSpaceOf(false)}
        host={fakeLightPassHost(300, 200)}
        canvasModulate={night}
      >
        <ReadModulate />
      </CanvasLightPass>
    );
    expect(seen).toEqual(night);
  });

  describe('seeds the accumulators with the canvas modulate in the space the items shade in', () => {
    const NIGHT: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

    /** The canvas modulate the pass seeded its accumulators with on its latest run. */
    async function seedIn(space: CanvasColorSpace): Promise<{ r: number; g: number; b: number }> {
      const host = fakeLightPassHost(300, 200);
      const seen: Seen = {};
      await ReactThreeTestRenderer.create(
        <CanvasLightPass space={space} host={host} canvasModulate={NIGHT}>
          <Scene seen={seen} />
        </CanvasLightPass>
      );
      await settleLoads();
      vi.mocked(renderLightLists).mockClear();
      await withStubbedGl(seen.gl!, {}, () => host.run.current!());
      return vi.mocked(renderLightLists).mock.lastCall![0].canvasModulate;
    }

    it('keeps the authored tint in an sRGB canvas', async () => {
      expect((await seedIn(canvasColorSpaceOf(false))).r).toBe(0.5);
    });

    it('converts the tint to linear in a linear canvas', async () => {
      expect((await seedIn(canvasColorSpaceOf(true))).r).toBeCloseTo(0.214, 3);
    });
  });
});
