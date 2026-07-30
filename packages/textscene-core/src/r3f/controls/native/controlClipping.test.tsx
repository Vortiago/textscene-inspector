/**
 * `controlClipping` carries an accumulated `THREE.Plane[]` down the native
 * Control tree — a verified spike (see the packet's own findings) established
 * that clip PLANES, not stencil, are correct here: the on-screen 2D canvas
 * requests no stencil buffer at all, so a stencil-based clip would be a
 * silent no-op. `ScrollContainer` (`nodes/2d/ui/scrollcontainer/NativeComponent.tsx`)
 * is this module's first real contributor: it builds its own 4 planes from
 * `localRectClipPlanes`, transforms them into world space via its own
 * `matrixWorld`, and merges them onto whatever it inherited with
 * `withAdditionalClipPlanes` before providing the result to its subtree.
 * These tests pin the seam: default-empty, inherits through the provider, the
 * pure accumulator, and the rect-to-planes conversion every contributor calls.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import {
  ControlClipProvider,
  localRectClipPlanes,
  useControlClipPlanes,
  withAdditionalClipPlanes,
} from './controlClipping';
import type { Rect2 } from './rect';

describe('useControlClipPlanes', () => {
  it('defaults to an empty plane list outside any provider', () => {
    const { result } = renderHook(() => useControlClipPlanes());
    expect(result.current).toEqual([]);
  });

  it('reads whatever the nearest provider carries', () => {
    const plane = new THREE.Plane();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ControlClipProvider value={[plane]}>{children}</ControlClipProvider>
    );
    const { result } = renderHook(() => useControlClipPlanes(), { wrapper });
    expect(result.current).toEqual([plane]);
  });
});

describe('withAdditionalClipPlanes', () => {
  it('returns the SAME inherited array when nothing new is added (edge: no re-render churn)', () => {
    const inherited: readonly THREE.Plane[] = [new THREE.Plane()];
    expect(withAdditionalClipPlanes(inherited, [])).toBe(inherited);
  });

  it('concatenates inherited + own planes, inherited first', () => {
    const parentPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const ownPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    expect(withAdditionalClipPlanes([parentPlane], [ownPlane])).toEqual([parentPlane, ownPlane]);
  });
});

describe('localRectClipPlanes', () => {
  // rect.ts: Rect2 is Godot pixels, +Y down, local to this node's own
  // top-left — the SAME frame `NativeControlComponentProps.rect` uses. The
  // four planes convert Y at this boundary (this module's job, same as the
  // walker's own `[rect.x, -rect.y, 0]` conversion), so a point is "kept" iff
  // it falls inside the rect once Y is negated.
  const rect: Rect2 = { x: 100, y: 50, w: 200, h: 80 }; // local x in [100,300], y in [50,130]

  function distances(planes: readonly THREE.Plane[], x: number, y: number): number[] {
    const p = new THREE.Vector3(x, y, 0);
    return planes.map((plane) => plane.distanceToPoint(p));
  }

  it('produces exactly 4 planes', () => {
    expect(localRectClipPlanes(rect)).toHaveLength(4);
  });

  it('keeps a point just inside every edge (distance >= 0)', () => {
    const planes = localRectClipPlanes(rect);
    // left=100 -> x=101; right=300 -> x=299; top(local y=50) -> world y=-51;
    // bottom(local y=130) -> world y=-129.
    for (const [x, y] of [
      [101, -60],
      [299, -60],
      [200, -51],
      [200, -129],
    ]) {
      expect(distances(planes, x!, y!).every((d) => d >= 0)).toBe(true);
    }
  });

  it('rejects a point just outside each edge (that edge’s own plane goes negative)', () => {
    const [leftPlane, rightPlane, bottomPlane, topPlane] = localRectClipPlanes(rect);
    expect(leftPlane!.distanceToPoint(new THREE.Vector3(99, -90, 0))).toBeLessThan(0);
    expect(rightPlane!.distanceToPoint(new THREE.Vector3(301, -90, 0))).toBeLessThan(0);
    expect(bottomPlane!.distanceToPoint(new THREE.Vector3(200, -131, 0))).toBeLessThan(0);
    expect(topPlane!.distanceToPoint(new THREE.Vector3(200, -49, 0))).toBeLessThan(0);
  });
});
