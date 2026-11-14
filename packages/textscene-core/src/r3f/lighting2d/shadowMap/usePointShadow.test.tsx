/**
 * `usePointShadow` keeps one polar map texture for the life of a shadowed light: both quad
 * materials hold it in `uShadowMap`, so a new texture on a rebuild would rebuild both of them.
 * These drive the real R3F loop around the pose sampler.
 */

import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { usePointShadow } from './usePointShadow';
import type { ShadowSampling } from './shadowSampling';
import type { WorldShadowCaster } from '../shadowCasterRegistry';
import { worldEdges } from '../testing/worldEdges';
import { SHADOW_MAP_FAR } from './shadowPolarMap';
import { Light2DShadowFilter } from '../../../godot/scene/light2d';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';

const LOOK = {
  filter: Light2DShadowFilter.PCF13,
  smooth: 3,
  shadowColor: { r: 0.2, g: 0.1, b: 0.4, a: 0.5 },
};

/** A vertical wall at world x = `x`, in front of a light at the origin. */
function wall(x: number): WorldShadowCaster {
  return { ...worldEdges([x, -20, x, 20], OccluderPolygon2DCullMode.DISABLED), occluderLightMask: 1 };
}

/** Every value the hook returned, in order, including the undefined before the first map. */
type Published = (ShadowSampling | undefined)[];

function Harness({
  published,
  casters,
  lightX = 0,
}: {
  published: Published;
  casters: readonly WorldShadowCaster[];
  lightX?: number;
}) {
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const shadow = usePointShadow(quad, casters, LOOK);
  useEffect(() => {
    published.push(shadow);
  }, [shadow, published]);
  return (
    <group position={[lightX, 0, 0]}>
      <mesh ref={setQuad}>
        <planeGeometry args={[200, 200]} />
      </mesh>
    </group>
  );
}

async function mount(casters: readonly WorldShadowCaster[], lightX = 0) {
  const published: Published = [];
  const renderer = await ReactThreeTestRenderer.create(
    <Harness published={published} casters={casters} lightX={lightX} />
  );
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, published };
}

function latest(published: Published): ShadowSampling | undefined {
  return published[published.length - 1];
}

/** The bins the map holds now. */
function bins(shadow: ShadowSampling): Float32Array {
  return (shadow.map as THREE.DataTexture).image.data as Float32Array;
}

describe('usePointShadow', () => {
  it('hands the quads a map with the look the light reads it with', async () => {
    const { published } = await mount([wall(50)]);
    const shadow = latest(published);
    expect(shadow).toMatchObject(LOOK);
    expect(shadow && Array.from(bins(shadow)).some((depth) => depth < SHADOW_MAP_FAR)).toBe(true);
  });

  it('casts nothing while the light has no casters', async () => {
    const { published } = await mount([]);
    expect(latest(published)).toBeUndefined();
  });

  it('refills the same texture when a caster moves, so the materials keep it', async () => {
    const { renderer, published } = await mount([wall(50)]);
    const before = latest(published)!;
    const nearDepths = Array.from(bins(before));
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Harness published={published} casters={[wall(80)]} />);
    });
    const after = latest(published)!;
    expect(after.map).toBe(before.map);
    expect(Array.from(bins(after))).not.toEqual(nearDepths);
  });

  it('writes a moved light into the pose its materials already hold', async () => {
    const { renderer, published } = await mount([wall(50)]);
    const before = latest(published)!;
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Harness published={published} casters={[wall(50)]} lightX={10} />);
    });
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1 / 60);
    });
    const after = latest(published)!;
    expect(after.pose).toBe(before.pose);
    // The light-local x of world x = 0 is -10 once the light sits at x = 10.
    expect(after.pose.uWorldToLight.value.elements[6]).toBeCloseTo(-10);
  });

  it('disposes the map once the casters go away', async () => {
    const { renderer, published } = await mount([wall(50)]);
    const map = latest(published)!.map;
    const dispose = vi.spyOn(map, 'dispose');
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Harness published={published} casters={[]} />);
    });
    expect(latest(published)).toBeUndefined();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
