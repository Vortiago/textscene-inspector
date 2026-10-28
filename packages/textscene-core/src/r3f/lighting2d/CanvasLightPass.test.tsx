/**
 * A light pass runs on the host that mounts it: through the host's scene and camera, into buffers
 * of the host's size, when the host calls `run`. The 2D stage and each SubViewport are such hosts.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLightPass } from './CanvasLightPass';
import { useCanvasLighting2D, type CanvasLighting2D } from './lightPassContext';
import { useRegisterCanvasLight2D, useRegisterLitItem, usePassMeshRef } from './lightPassDeclarations';
import { DEFAULT_LIGHT_CULL_KEY } from './lightCullKey';
import { fakeLightPassHost } from './testing/fakeLightPassHost';
import type { LightPassHost } from './lightPassHost';
import { useCanvasModulate } from '../canvasModulate';
import type { Rgba } from '../../godot/math/math';
import { settleLoads } from '../testing/settleLoads';
import { withStubbedGl } from '../testing/stubbedGl';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

interface Seen {
  gl?: THREE.WebGLRenderer;
  lighting?: CanvasLighting2D;
}

/** A lamp the pass draws, and an item that reads it. */
function Scene({ seen }: { seen: Seen }) {
  seen.gl = useThree((state) => state.gl);
  seen.lighting = useCanvasLighting2D();
  const ordinal = useRegisterCanvasLight2D(true, {
    reach: DEFAULT_LIGHT_CULL_KEY,
    sequence: 0,
    shadowItemCullMask: null,
    tintsShadow: false,
  });
  const meshRef = usePassMeshRef<THREE.Mesh>(ordinal, 'lit');
  useRegisterLitItem({ lightMask: 1, z: 0, layer: 0, takenLights: null }, false);
  return <mesh ref={meshRef} />;
}

interface Draw {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly size: [number, number];
}

async function mount(host: LightPassHost) {
  const seen: Seen = {};
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasLightPass host={host} canvasModulate={WHITE}>
      <Scene seen={seen} />
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
      <CanvasLightPass host={fakeLightPassHost(300, 200)} canvasModulate={night}>
        <ReadModulate />
      </CanvasLightPass>
    );
    expect(seen).toEqual(night);
  });
});
