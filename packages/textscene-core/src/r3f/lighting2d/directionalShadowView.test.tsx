/**
 * Where a DirectionalLight2D's shadow is measured from: the light's own +Y axis
 * (`renderer_viewport.cpp:564`, "Y is light direction") and the game viewport it renders into,
 * and how the editor camera reaches the map. These drive the real R3F loop.
 */

import { describe, it, expect } from 'vitest';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { useDirectionalShadowView, useNdcToShadow } from './directionalShadowView';
import { buildDirectionalShadowMap, type DirectionalShadowView } from './directionalShadowMap';

/** Every view the hook published, in order, including the initial null. */
type Published = (DirectionalShadowView | null)[];

function ViewHarness({
  published,
  godotRotation = 0,
  maxDistance = 0,
  enabled = true,
}: {
  published: Published;
  godotRotation?: number;
  maxDistance?: number;
  enabled?: boolean;
}) {
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);
  const view = useDirectionalShadowView(anchor, enabled, maxDistance);
  useEffect(() => {
    published.push(view);
  }, [view, published]);
  // The previewer conjugates the 2D tree by diag(1, -1), which negates a rotation.
  return <group ref={setAnchor} rotation={[0, 0, -godotRotation]} />;
}

async function mountView(props: Omit<Parameters<typeof ViewHarness>[0], 'published'> = {}) {
  const published: Published = [];
  const renderer = await ReactThreeTestRenderer.create(<ViewHarness published={published} {...props} />);
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, published };
}

function latest(published: Published): DirectionalShadowView {
  const view = published.at(-1);
  expect(view).toBeTruthy();
  return view!;
}

describe('useDirectionalShadowView', () => {
  it('sends an unrotated light down the screen, Godot +Y', async () => {
    const { direction } = latest((await mountView()).published);
    expect(direction.x).toBeCloseTo(0, 12);
    expect(direction.y).toBeCloseTo(-1, 12);
  });

  it('turns the light with its rotation, clockwise on screen for a positive one', async () => {
    // Godot 4.6.3 at rotation 0.5 shadows down and to the left of the occluder.
    const { direction } = latest((await mountView({ godotRotation: 0.5 })).published);
    expect(direction.x).toBeCloseTo(-Math.sin(0.5), 12);
    expect(direction.y).toBeCloseTo(-Math.cos(0.5), 12);
  });

  it("clips to Godot's default project viewport at the canvas origin", async () => {
    const { clip } = latest((await mountView()).published);
    // `+ 0` folds the -0 that flipping the canvas origin's y gives.
    expect(clip.map(({ x, y }) => [x, y + 0])).toEqual([
      [0, -648],
      [1152, -648],
      [1152, 0],
      [0, 0],
    ]);
  });

  it('keeps max_distance in canvas pixels', async () => {
    expect(latest((await mountView({ maxDistance: 100 })).published).maxDistance).toBe(100);
  });

  it('publishes once for a still light, however many frames run', async () => {
    const { renderer, published } = await mountView();
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(20, 1 / 60);
    });
    expect(published.filter((view) => view !== null)).toHaveLength(1);
  });

  it('publishes null while disabled', async () => {
    const { published } = await mountView({ enabled: false });
    expect(published.every((view) => view === null)).toBe(true);
  });
});

/** Reports the matrix the hook returns for a map over a 1000 px square viewport. */
function NdcHarness({ onMatrix }: { onMatrix: (matrix: THREE.Matrix3) => void }) {
  const map = buildDirectionalShadowMap(
    {
      clip: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      direction: { x: 0, y: -1 },
      maxDistance: 0,
    },
    []
  );
  const [worldToShadow] = useState(() => map.worldToShadow);
  onMatrix(useNdcToShadow(worldToShadow));
  return null;
}

/** An orthographic camera showing the square exactly: x 0..1000, y 0..1000. */
function squareCamera(): THREE.OrthographicCamera {
  // `manual`, so R3F keeps these bounds rather than refitting them to the test canvas.
  const camera = Object.assign(new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 100), {
    manual: true,
  });
  camera.position.set(500, 500, 10);
  camera.updateProjectionMatrix();
  return camera;
}

/** `(u, depth)` at an NDC point through `matrix`. */
function lookup(matrix: THREE.Matrix3, x: number, y: number): [number, number] {
  const point = new THREE.Vector3(x, y, 1).applyMatrix3(matrix);
  return [point.x, point.y];
}

describe('useNdcToShadow', () => {
  it("maps the camera's NDC onto the map: NDC (0, 0.2) is world (500, 600), 400 px deep", async () => {
    let matrix = new THREE.Matrix3();
    const camera = squareCamera();
    await ReactThreeTestRenderer.create(<NdcHarness onMatrix={(m) => (matrix = m)} />, { camera });
    await ReactThreeTestRenderer.act(async () => {});
    const [u, depth] = lookup(matrix, 0, 0.2);
    expect(u).toBeCloseTo(0.5, 9);
    expect(depth).toBeCloseTo(0.4, 9);
  });

  it('follows a pan on the next frame in the same matrix, with no republish', async () => {
    const matrices = new Set<THREE.Matrix3>();
    const camera = squareCamera();
    const renderer = await ReactThreeTestRenderer.create(<NdcHarness onMatrix={(m) => matrices.add(m)} />, {
      camera,
    });
    camera.position.x += 100;
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1 / 60);
    });
    const [matrix] = [...matrices];
    expect(matrices.size).toBe(1);
    // NDC 0 is now world x 600, 100 px right of the centre over the 1414.2 px diagonal.
    expect(lookup(matrix!, 0, 0)[0]).toBeCloseTo(0.5 + 100 / (1000 * Math.SQRT2), 9);
  });

  it('holds the identity until a map exists', async () => {
    let matrix: THREE.Matrix3 | null = null;
    function Empty() {
      matrix = useNdcToShadow(null);
      return null;
    }
    await ReactThreeTestRenderer.create(<Empty />);
    expect(matrix!.equals(new THREE.Matrix3())).toBe(true);
  });
});
