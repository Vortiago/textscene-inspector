/**
 * `useShadowLightPose`'s republish contract.
 *
 * The hook samples in `useFrame`, so it runs for every shadowed light on every
 * frame whether or not anything moved. What it must guarantee is not "a pose"
 * but WHEN a pose changes identity: the value feeds `buildShadowPolarMap` and
 * both quad materials, so a spurious republish rebuilds a light's whole shadow
 * and a missing one leaves it stale.
 *
 * These drive the real R3F loop rather than calling `sampleShadowLight`
 * directly — the pure function has its own tests, and the thing worth pinning
 * here is the early-out around it.
 */

import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { useShadowLightPose, type ShadowLightPose } from './shadowLightPose';

/** Every pose the hook published, in order, including the initial null. */
type Published = (ShadowLightPose | null)[];

function Harness({
  published,
  enabled = true,
  x = 0,
  offsetX = 0,
}: {
  published: Published;
  enabled?: boolean;
  x?: number;
  /** The quad's own local offset — `Light2D.offset`, which moves the cookie. */
  offsetX?: number;
}) {
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const pose = useShadowLightPose(quad, enabled);

  useEffect(() => {
    published.push(pose);
  }, [pose, published]);

  return (
    <group position={[x, 0, 0]}>
      <mesh ref={setQuad} position={[offsetX, 0, 0]}>
        <planeGeometry args={[100, 60]} />
      </mesh>
    </group>
  );
}

async function mount(props: Omit<Parameters<typeof Harness>[0], 'published'>) {
  const published: Published = [];
  const renderer = await ReactThreeTestRenderer.create(
    <Harness published={published} {...props} />
  );
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, published };
}

/** Poses that are actually a pose — the leading null is mount, not a republish. */
function poses(published: Published): ShadowLightPose[] {
  return published.filter((p): p is ShadowLightPose => p !== null);
}

describe('useShadowLightPose', () => {
  it('publishes once for a still light, however many frames run', async () => {
    const { renderer, published } = await mount({});
    expect(poses(published)).toHaveLength(1);

    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(20, 1 / 60);
    });
    // Twenty frames of sampling; the guard means none of them republished.
    expect(poses(published)).toHaveLength(1);
  });

  it('does no matrix inversion on a frame where nothing moved', async () => {
    // The republish contract above holds with or without the input guard — the
    // equality gate already suppressed the setState. What the guard buys is the
    // WORK, and the 4x4 inverse is the expensive half of it, so that is what is
    // asserted. Without the guard this is one inversion per light per frame,
    // forever, on a scene that has been still since load.
    const { renderer } = await mount({ x: 300 });
    const invert = vi.spyOn(THREE.Matrix4.prototype, 'invert');
    try {
      await ReactThreeTestRenderer.act(async () => {
        renderer.advanceFrames(10, 1 / 60);
      });
      expect(invert).not.toHaveBeenCalled();
    } finally {
      invert.mockRestore();
    }
  });

  it('publishes the light rect and origin its quad actually occupies', async () => {
    const { published } = await mount({ x: 400 });
    const pose = poses(published)[0]!;
    expect(pose.x).toBeCloseTo(400, 6);
    expect(pose.rect.minX).toBeCloseTo(350, 6);
    expect(pose.rect.maxX).toBeCloseTo(450, 6);
    expect(pose.radius).toBeCloseTo(Math.hypot(100, 60), 6);
  });

  it('republishes when the light moves, and not before', async () => {
    const { renderer, published } = await mount({ x: 0 });
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(3, 1 / 60);
    });
    expect(poses(published)).toHaveLength(1);

    await renderer.update(<Harness published={published} x={250} />);
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1 / 60);
    });

    const seen = poses(published);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]!.x).toBeCloseTo(250, 6);
  });

  it('drops the cached inputs when the light is disabled and re-enabled', async () => {
    // The transform never changes across the toggle, so a cache that survived
    // it would compare equal and the re-enabled light would never publish —
    // its shadows would simply never come back, with nothing failing.
    const { renderer, published } = await mount({ x: 120 });
    expect(poses(published)).toHaveLength(1);

    await renderer.update(<Harness published={published} x={120} enabled={false} />);
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(2, 1 / 60);
    });
    expect(published[published.length - 1]).toBeNull();

    await renderer.update(<Harness published={published} x={120} enabled />);
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(2, 1 / 60);
    });
    expect(published[published.length - 1]).not.toBeNull();
    expect(published[published.length - 1]!.x).toBeCloseTo(120, 6);
  });

  it('radiates from the light NODE while the rect follows the offset cookie', async () => {
    // Godot's `offset` moves the cookie without moving the space the shadow map
    // is stated in, so the origin comes off the PARENT's world matrix and the
    // rect off the quad's. Reading both from the quad would swing every shadow
    // sideways on any light that authors an offset.
    const { published } = await mount({ x: 400, offsetX: 50 });
    const pose = poses(published)[0]!;
    expect(pose.x).toBeCloseTo(400, 6);
    expect(pose.rect.minX).toBeCloseTo(400, 6);
    expect(pose.rect.maxX).toBeCloseTo(500, 6);
  });

  it('publishes nothing at all while disabled', async () => {
    const { renderer, published } = await mount({ enabled: false });
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(5, 1 / 60);
    });
    expect(poses(published)).toHaveLength(0);
  });
});
