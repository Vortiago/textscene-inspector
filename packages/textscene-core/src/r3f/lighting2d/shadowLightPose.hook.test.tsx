/**
 * `useShadowLightPose` samples every frame and republishes only on a change: the pose feeds
 * `buildShadowPolarMap` and both quad materials, so a spurious republish rebuilds the shadow and a
 * missing one leaves it stale. These drive the real R3F loop. Godot builds the occluder cull rect
 * from the cookie (`RendererCanvasCull::_light_find_shadow`: `texture_size * texture_scale`, offset
 * by `texture_offset`) and radiates the shadow from the node's origin, which `offset` does not move.
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
  width = 100,
}: {
  published: Published;
  enabled?: boolean;
  x?: number;
  /** The quad's own local offset: `Light2D.offset`, which moves the cookie. */
  offsetX?: number;
  /** The cookie's width, which sets the light's reach. */
  width?: number;
}) {
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const pose = useShadowLightPose(quad, enabled);

  useEffect(() => {
    published.push(pose);
  }, [pose, published]);

  return (
    <group position={[x, 0, 0]}>
      <mesh ref={setQuad} position={[offsetX, 0, 0]}>
        <planeGeometry args={[width, 60]} />
      </mesh>
    </group>
  );
}

async function mount(props: Omit<Parameters<typeof Harness>[0], 'published'>) {
  const published: Published = [];
  const renderer = await ReactThreeTestRenderer.create(<Harness published={published} {...props} />);
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, published };
}

/** The published poses without the leading null, which is mount, not a republish. */
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
    // The equality gate alone suppresses the setState. The input guard saves the work, mostly the
    // 4x4 inverse: without it, one inversion per light per frame on a scene still since load.
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
    // The transform never changes across the toggle, so a cache that survived it would compare
    // equal, and the re-enabled light would never publish its shadows again.
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
    // is stated in, so the origin comes off the parent's world matrix and the
    // rect off the quad's. Reading both from the quad would swing every shadow
    // sideways on any light that authors an offset.
    const { published } = await mount({ x: 400, offsetX: 50 });
    const pose = poses(published)[0]!;
    expect(pose.x).toBeCloseTo(400, 6);
    expect(pose.rect.minX).toBeCloseTo(400, 6);
    expect(pose.rect.maxX).toBeCloseTo(500, 6);
  });

  it('republishes when only the reach changes', async () => {
    const { renderer, published } = await mount({});
    await renderer.update(<Harness published={published} width={200} />);
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1 / 60);
    });

    const seen = poses(published);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.radius).toBeCloseTo(Math.hypot(200, 60), 6);
  });

  it('publishes nothing at all while disabled', async () => {
    const { renderer, published } = await mount({ enabled: false });
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(5, 1 / 60);
    });
    expect(poses(published)).toHaveLength(0);
  });
});

/** A cookie quad of `size` at `offset`, under a CanvasItem group at `at`. */
function quadUnder(
  at: { x: number; y: number },
  offset: { x: number; y: number } = { x: 0, y: 0 },
  size = 200,
  transform: (group: THREE.Group) => void = () => {}
): THREE.Mesh {
  const root = new THREE.Group();
  const item = new THREE.Group();
  item.position.set(at.x, at.y, 0);
  transform(item);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size));
  mesh.position.set(offset.x, offset.y, 0);
  item.add(mesh);
  root.add(item);
  return mesh;
}

describe('the pose of a light', () => {
  it('takes the shadow origin from the light node, not the cookie centre', async () => {
    const pose = (await publishedPose(quadUnder({ x: 400, y: -324 })))!;
    expect(pose.x).toBe(400);
    expect(pose.y).toBe(-324);
  });

  it('bounds the rect by the cookie, which is what Godot culls occluders against', async () => {
    const pose = (await publishedPose(quadUnder({ x: 400, y: -324 }, { x: 0, y: 0 }, 1024)))!;
    expect(pose.rect).toEqual({ minX: -112, minY: -836, maxX: 912, maxY: 188 });
  });

  it('moves the rect with offset but leaves the origin where the node is', async () => {
    const pose = (await publishedPose(quadUnder({ x: 0, y: 0 }, { x: 50, y: -20 }, 200)))!;
    expect([pose.x, pose.y]).toEqual([0, 0]);
    expect(pose.rect).toEqual({ minX: -50, minY: -120, maxX: 150, maxY: 80 });
  });

  it('scales the rect with the node transform', async () => {
    const pose = (await publishedPose(
      quadUnder({ x: 0, y: 0 }, { x: 0, y: 0 }, 200, (g) => g.scale.set(2, 0.5, 1))
    ))!;
    expect(pose.rect).toEqual({ minX: -200, minY: -50, maxX: 200, maxY: 50 });
  });

  it('bounds a rotated cookie by its corners, never by its edges', async () => {
    // A 45° square's AABB grows by √2, so an axis-aligned box built from the
    // untransformed extents would under-cover it and cull a real occluder.
    const pose = (await publishedPose(
      quadUnder({ x: 0, y: 0 }, { x: 0, y: 0 }, 200, (g) => {
        g.rotation.z = Math.PI / 4;
      })
    ))!;
    expect(pose.rect.maxX).toBeCloseTo(100 * Math.SQRT2, 4);
    expect(pose.rect.minY).toBeCloseTo(-100 * Math.SQRT2, 4);
  });

  it('reports Godot radius_cache: the cookie rect diagonal in light-local units', async () => {
    // `renderer_viewport.cpp:485`: `local_rect.size.length()`, so a 200×200
    // cookie gives 200√2 wherever the light sits and however it is scaled (the
    // scale is already in `local_rect` through `texture_scale`, not in the node).
    const pose = (await publishedPose(quadUnder({ x: 400, y: -324 }, { x: 0, y: 0 }, 200)))!;
    expect(pose.radius).toBeCloseTo(200 * Math.SQRT2, 9);
    const moved = (await publishedPose(quadUnder({ x: 0, y: 0 }, { x: 90, y: 30 }, 200)))!;
    expect(moved.radius).toBeCloseTo(200 * Math.SQRT2, 9);
  });

  it('inverts the light NODE frame, so offset never enters the shadow space', async () => {
    // The polar map is stated in the light's own space; `offset` moves the
    // cookie inside that space and must leave the mapping alone.
    const pose = (await publishedPose(quadUnder({ x: 400, y: -324 }, { x: 50, y: 20 })))!;
    const [m00, m01, m02, m10, m11, m12] = pose.worldToLocal;
    expect([m00, m01, m10, m11]).toEqual([1, 0, 0, 1]);
    expect([m02, m12]).toEqual([-400, 324]);
  });

  it('carries the light rotation into the inverse frame', async () => {
    // A quarter-turn light: its local +X points along world +Y, so a world point
    // 100 above the light maps to local (100, 0).
    const pose = (await publishedPose(
      quadUnder({ x: 400, y: 300 }, { x: 0, y: 0 }, 200, (g) => {
        g.rotation.z = Math.PI / 2;
      })
    ))!;
    const [m00, m01, m02, m10, m11, m12] = pose.worldToLocal;
    expect(m00 * 400 + m01 * 400 + m02).toBeCloseTo(100, 6);
    expect(m10 * 400 + m11 * 400 + m12).toBeCloseTo(0, 6);
  });

  it('accumulates every ancestor transform, not just the immediate parent', async () => {
    const mesh = quadUnder({ x: 100, y: -50 });
    (mesh.parent!.parent as THREE.Group).position.set(300, -90, 0);
    const pose = (await publishedPose(mesh))!;
    expect([pose.x, pose.y]).toEqual([400, -140]);
  });

  it('is null for a quad that is not in a tree yet', async () => {
    expect(await publishedPose(null)).toBeNull();
    expect(await publishedPose(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)), false)).toBeNull();
  });

  it('is null for geometry with no bounds to take a rect from', async () => {
    const mesh = quadUnder({ x: 0, y: 0 });
    mesh.geometry = new THREE.BufferGeometry();
    expect(await publishedPose(mesh)).toBeNull();
  });
});

/** The topmost ancestor of `object`. */
function rootOf(object: THREE.Object3D): THREE.Object3D {
  return object.parent ? rootOf(object.parent) : object;
}

/**
 * The pose the hook publishes for a quad built outside React. Its tree mounts under the scene,
 * which sits at the origin, unless `isMounted` is false.
 */
async function publishedPose(quad: THREE.Mesh | null, isMounted = true): Promise<ShadowLightPose | null> {
  const published: Published = [];
  function Probe() {
    const pose = useShadowLightPose(quad, true);
    useEffect(() => {
      published.push(pose);
    }, [pose]);
    return quad && isMounted ? <primitive object={rootOf(quad)} /> : null;
  }
  await ReactThreeTestRenderer.create(<Probe />);
  await ReactThreeTestRenderer.act(async () => {});
  return published[published.length - 1] ?? null;
}
