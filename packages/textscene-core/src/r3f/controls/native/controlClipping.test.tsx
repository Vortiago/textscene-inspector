/**
 * Pins the clip seam: empty by default, inherited through the provider, and the
 * hook that turns a node-local rect into a world rect, intersects, quantizes and
 * converts it to planes.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { ControlClipProvider, useControlClipPlanes, useWorldClipPlanes } from './controlClipping';
import type { Rect2 } from './rect';

describe('useControlClipPlanes', () => {
  it('defaults to an empty plane list outside any provider', () => {
    const { result } = renderHook(() => useControlClipPlanes());
    expect(result.current).toEqual([]);
  });

  it('reads whatever the nearest provider carries', () => {
    const plane = new THREE.Plane();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ControlClipProvider value={{ planes: [plane], rect: null }}>{children}</ControlClipProvider>
    );
    const { result } = renderHook(() => useControlClipPlanes(), { wrapper });
    expect(result.current).toEqual([plane]);
  });
});

describe('useWorldClipPlanes', () => {
  /** Left, right, bottom, top plane constants, in the order the planes are built. */
  function constants(planes: readonly THREE.Plane[]): number[] {
    return planes.map((p) => p.constant);
  }

  /** The planes a rect publishes under a world group at `world`, rendered to completion. */
  async function planesFor(
    props: Omit<Parameters<typeof Harness>[0], 'onPlanes'>
  ): Promise<readonly THREE.Plane[]> {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(<Harness {...props} onPlanes={(p) => (captured = p)} />);
    return captured;
  }

  function Harness({
    rect,
    world,
    scale = 1,
    scaleX = scale,
    rotation = 0,
    inner = [0, 0],
    onPlanes,
  }: {
    rect: Rect2;
    world: [number, number];
    scale?: number;
    scaleX?: number;
    rotation?: number;
    inner?: [number, number];
    onPlanes: (planes: readonly THREE.Plane[]) => void;
  }) {
    const { anchorRef, clippingPlanes } = useWorldClipPlanes(rect);
    useEffect(() => {
      onPlanes(clippingPlanes);
    }, [clippingPlanes, onPlanes]);
    return (
      <group position={[world[0], world[1], 0]} scale={[scaleX, scale, 1]} rotation={[0, 0, rotation]}>
        <group position={[inner[0], inner[1], 0]}>
          <group ref={anchorRef} />
        </group>
      </group>
    );
  }

  it('quantizes a fractional clip rect the way Godot quantizes a scissor', async () => {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <Harness
        rect={{ x: 0, y: 0, w: 322, h: 195 }}
        world={[600, -340]}
        scale={1.25}
        inner={[79, -17]}
        onPlanes={(p) => (captured = p)}
      />
    );
    // World rect (698.75, 361.25, 402.5, 243.75) -> (699, 361, 403, 244):
    // right edge x = 1102, bottom edge Godot y = 605, that is world y = -605.
    expect(constants(captured)).toEqual([-699, 1102, 605, -361]);
  });

  it('agrees with a rounded edge when the origin is already whole', async () => {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <Harness
        rect={{ x: 0, y: 0, w: 500.25, h: 280.75 }}
        world={[20, -20]}
        onPlanes={(p) => (captured = p)}
      />
    );
    expect(constants(captured)).toEqual([-20, 520, 301, -20]);
  });

  it('rounds in Godot canvas space, not in the +Y-up world the planes live in', async () => {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <Harness rect={{ x: 0, y: 20.5, w: 100, h: 100.5 }} world={[0, 0]} onPlanes={(p) => (captured = p)} />
    );
    // Godot space: round(20.5) = 21 and round(100.5) = 101, so the bottom edge
    // is 122. Rounding the +Y-up position (the BOTTOM, -121) instead would put
    // the top at 20 and the bottom at 121.
    expect(constants(captured)).toEqual([-0, 100, 122, -21]);
  });

  it('intersects an inherited rect before rounding, and publishes 4 planes, not 8', async () => {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes: [], rect: { x: 0, y: 0, w: 60, h: 400 } }}>
        <Harness rect={{ x: 0, y: 0, w: 500, h: 100 }} world={[10, -10]} onPlanes={(p) => (captured = p)} />
      </ControlClipProvider>
    );
    expect(captured).toHaveLength(4);
    expect(constants(captured)).toEqual([-10, 60, 110, -10]);
  });

  it('falls back to accumulated planes under a rotated ancestor (no rect to round)', async () => {
    let captured: readonly THREE.Plane[] = [];
    const inherited = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    function RotatedHarness() {
      const { anchorRef, clippingPlanes } = useWorldClipPlanes({ x: 0, y: 0, w: 40, h: 20 });
      useEffect(() => {
        captured = clippingPlanes;
      }, [clippingPlanes]);
      return (
        <group rotation={[0, 0, 0.3]}>
          <group ref={anchorRef} />
        </group>
      );
    }
    await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes: [inherited], rect: null }}>
        <RotatedHarness />
      </ControlClipProvider>
    );
    expect(captured).toHaveLength(5);
    expect(captured[0]).toBe(inherited);
  });

  it('keeps a point just inside every edge and rejects a point just outside each edge', async () => {
    // A Rect2 is Godot pixels, +Y down (`rect.ts`): x in [100, 300], y in [50, 130], so world y in [-130, -50].
    const [left, right, bottom, top] = await planesFor({
      rect: { x: 100, y: 50, w: 200, h: 80 },
      world: [0, 0],
    });
    const planes = [left!, right!, bottom!, top!];
    for (const [x, y] of [
      [101, -60],
      [299, -60],
      [200, -51],
      [200, -129],
    ]) {
      expect(planes.every((plane) => plane.distanceToPoint(new THREE.Vector3(x, y, 0)) >= 0)).toBe(true);
    }
    expect(left!.distanceToPoint(new THREE.Vector3(99, -90, 0))).toBeLessThan(0);
    expect(right!.distanceToPoint(new THREE.Vector3(301, -90, 0))).toBeLessThan(0);
    expect(bottom!.distanceToPoint(new THREE.Vector3(200, -131, 0))).toBeLessThan(0);
    expect(top!.distanceToPoint(new THREE.Vector3(200, -49, 0))).toBeLessThan(0);
  });

  it.each([
    [500.5, 521],
    [500.75, 521],
  ])('puts the far edge of a whole-pixel origin at the rounded edge for width %s', async (w, edge) => {
    const planes = await planesFor({ rect: { x: 0, y: 0, w, h: 10 }, world: [20, -20] });
    expect(constants(planes)[1]).toBe(edge);
  });

  it('rounds halves away from zero, not up, for a clipper hanging off the canvas', async () => {
    // JavaScript's Math.round(-10.5) is -10, and std::round's is -11: the rect quantizes to (-11, -1, 6, 3).
    const planes = await planesFor({ rect: { x: -10.5, y: -0.5, w: 5.5, h: 2.5 }, world: [0, 0] });
    expect(constants(planes)).toEqual([11, -5, 2, 1]);
  });

  it('collapses a sub-half-pixel size to nothing, as Godot skips the item outright', async () => {
    const planes = await planesFor({ rect: { x: 10, y: 10, w: 0.4, h: 0.4 }, world: [0, 0] });
    expect(constants(planes)).toEqual([-10, 10, 10, -10]);
  });

  it('takes the corner extent under a mirrored scale rather than a negative size', async () => {
    // The rect lands at x in [460, 500], y in [100, 120].
    const planes = await planesFor({ rect: { x: 0, y: 0, w: 40, h: 20 }, world: [500, -100], scaleX: -1 });
    expect(constants(planes)).toEqual([-460, 500, 120, -100]);
  });

  it('still quantizes under a rotation that is an exact multiple of a quarter turn', async () => {
    // A half turn about the origin maps the rect to x in [-40, 0], y in [-20, 0].
    const planes = await planesFor({ rect: { x: 0, y: 0, w: 40, h: 20 }, world: [0, 0], rotation: Math.PI });
    expect(constants(planes).map((c) => Math.round(c) + 0)).toEqual([40, 0, 0, 20]);
    expect(planes.every((p) => Math.abs(p.normal.x * p.normal.y) < 1e-9)).toBe(true);
  });

  it('clips with rotated planes under a rotating transform, with nothing to quantize', async () => {
    const planes = await planesFor({ rect: { x: 0, y: 0, w: 40, h: 20 }, world: [0, 0], rotation: 0.3 });
    expect(planes).toHaveLength(4);
    expect(planes.some((p) => Math.abs(p.normal.x * p.normal.y) > 0.1)).toBe(true);
  });

  it('passes the inherited planes through as the same array while no anchor is attached', async () => {
    const inherited: readonly THREE.Plane[] = [new THREE.Plane()];
    let captured: readonly THREE.Plane[] = [];
    function Unanchored() {
      const { clippingPlanes } = useWorldClipPlanes({ x: 0, y: 0, w: 40, h: 20 });
      useEffect(() => {
        captured = clippingPlanes;
      }, [clippingPlanes]);
      return null;
    }
    await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes: inherited, rect: null }}>
        <Unanchored />
      </ControlClipProvider>
    );
    expect(captured).toBe(inherited);
  });
});
