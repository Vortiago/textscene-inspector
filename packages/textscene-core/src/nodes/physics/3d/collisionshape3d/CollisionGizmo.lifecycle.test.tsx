/**
 * A polygon gizmo decodes and builds its geometry once per shape resource, keeps it across a
 * re-render that leaves the shape alone, and disposes it once superseded or unmounted. R3F never
 * disposes a geometry handed over through the `geometry` prop, so without this each rebuild
 * leaves a GPU buffer behind.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactElement } from 'react';
import { CollisionGizmo } from './CollisionGizmo';
import type { TscnInternalResource } from '../../../../parser/types';

const { act } = ReactThreeTestRenderer;

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Written only by `mount`, emptied after each test. */
const mounted: Renderer[] = [];

afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

const CUBE_POINTS =
  'PackedVector3Array(-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5)';
const WIDE_CUBE_POINTS = CUBE_POINTS.replace(/0\.5/g, '2');
const ONE_TRIANGLE = 'PackedVector3Array(-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5)';
const OTHER_TRIANGLE = 'PackedVector3Array(-1, 0, -1, 1, 0, -1, 0, 0, 1)';

function convex(points: string): TscnInternalResource {
  return { id: 'Convex_1', type: 'ConvexPolygonShape3D', data: { points } };
}

function concave(data: string): TscnInternalResource {
  return { id: 'Concave_1', type: 'ConcavePolygonShape3D', data: { data } };
}

/** A fresh colour per call: a parent re-render hands over a new one each time. */
function gizmo(shape: TscnInternalResource): ReactElement {
  return <CollisionGizmo shape={shape} color={new THREE.Color(0x00ff88)} />;
}

async function mount(element: ReactElement): Promise<Renderer> {
  const renderer = await ReactThreeTestRenderer.create(element);
  mounted.push(renderer);
  return renderer;
}

/**
 * Lets the lazy `ConvexGeometry` import and its state update land, then re-flushes so the test
 * renderer's snapshot sees the commit, as `Component.test.tsx` does.
 */
async function settle(renderer: Renderer, element: ReactElement): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  });
  await renderer.update(element);
}

function drawnGeometry(renderer: Renderer): THREE.BufferGeometry | null {
  const meshes = renderer.scene.findAll((n) => n.type === 'Mesh');
  return meshes.length === 0 ? null : (meshes[0]!.instance as THREE.Mesh).geometry;
}

function requireGeometry(renderer: Renderer): THREE.BufferGeometry {
  const geometry = drawnGeometry(renderer);
  if (!geometry) throw new Error('expected the gizmo to draw a mesh');
  return geometry;
}

/** Counts `dispose()` calls on `geometry` from now on. */
function disposals(geometry: THREE.BufferGeometry): () => number {
  let count = 0;
  geometry.addEventListener('dispose', () => {
    count += 1;
  });
  return () => count;
}

describe('<CollisionGizmo> ConcavePolygonShape3D geometry lifecycle', () => {
  it('keeps one geometry across re-renders of the same shape', async () => {
    const shape = concave(ONE_TRIANGLE);
    const renderer = await mount(gizmo(shape));
    const first = requireGeometry(renderer);
    const disposed = disposals(first);

    await renderer.update(gizmo(shape));
    await renderer.update(gizmo(shape));
    expect(drawnGeometry(renderer)).toBe(first);
    expect(disposed()).toBe(0);
  });

  it('disposes the superseded geometry once the shape changes', async () => {
    const renderer = await mount(gizmo(concave(ONE_TRIANGLE)));
    const first = requireGeometry(renderer);
    const disposed = disposals(first);

    await renderer.update(gizmo(concave(OTHER_TRIANGLE)));
    const second = requireGeometry(renderer);
    expect(second).not.toBe(first);
    expect(Array.from(second.getAttribute('position').array)).toEqual([-1, 0, -1, 1, 0, -1, 0, 0, 1]);
    expect(disposed()).toBe(1);
  });

  it('disposes its geometry on unmount', async () => {
    const renderer = await mount(gizmo(concave(ONE_TRIANGLE)));
    const disposed = disposals(requireGeometry(renderer));
    await renderer.unmount();
    expect(disposed()).toBe(1);
  });

  it('draws nothing for fewer than three vertices (edge case)', async () => {
    const renderer = await mount(gizmo(concave('PackedVector3Array(0, 0, 0, 1, 0, 0)')));
    expect(drawnGeometry(renderer)).toBeNull();
  });
});

describe('<CollisionGizmo> ConvexPolygonShape3D hull lifecycle', () => {
  it('keeps one hull across re-renders of the same shape', async () => {
    const shape = convex(CUBE_POINTS);
    const renderer = await mount(gizmo(shape));
    await settle(renderer, gizmo(shape));
    const hull = requireGeometry(renderer);
    const disposed = disposals(hull);

    await settle(renderer, gizmo(shape));
    expect(drawnGeometry(renderer)).toBe(hull);
    expect(disposed()).toBe(0);
  });

  it('disposes the superseded hull once the points change', async () => {
    const cube = convex(CUBE_POINTS);
    const renderer = await mount(gizmo(cube));
    await settle(renderer, gizmo(cube));
    const first = requireGeometry(renderer);
    const disposed = disposals(first);

    const wider = convex(WIDE_CUBE_POINTS);
    await renderer.update(gizmo(wider));
    await settle(renderer, gizmo(wider));
    const second = requireGeometry(renderer);
    expect(second).not.toBe(first);
    second.computeBoundingBox();
    expect(second.boundingBox!.max.x).toBeCloseTo(2, 6);
    expect(disposed()).toBe(1);
  });

  it('disposes its hull and draws nothing once fewer than four points remain (edge case)', async () => {
    const cube = convex(CUBE_POINTS);
    const renderer = await mount(gizmo(cube));
    await settle(renderer, gizmo(cube));
    const disposed = disposals(requireGeometry(renderer));

    const degenerate = convex('PackedVector3Array(0, 0, 0, 1, 0, 0, 0, 1, 0)');
    await renderer.update(gizmo(degenerate));
    await settle(renderer, gizmo(degenerate));
    expect(drawnGeometry(renderer)).toBeNull();
    expect(disposed()).toBe(1);
  });

  it('disposes its hull on unmount', async () => {
    const cube = convex(CUBE_POINTS);
    const renderer = await mount(gizmo(cube));
    await settle(renderer, gizmo(cube));
    const disposed = disposals(requireGeometry(renderer));
    await renderer.unmount();
    expect(disposed()).toBe(1);
  });
});
