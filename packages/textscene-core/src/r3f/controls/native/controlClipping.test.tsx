/**
 * Pins the clip seam: empty by default, inherited through the provider, and the hook that
 * composes the steps `controlClipGeometry.test.ts` pins: world rect, intersection, rounding, planes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';
import { ControlClipProvider, useControlClipPlanes, useWorldClipPlanes } from './controlClipping';
import type { Rect2 } from '../../../godot/math/rect2';

const renderers: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>[] = [];

afterEach(async () => {
  await Promise.all(renderers.splice(0).map((renderer) => renderer.unmount()));
});

/** Renders `element` to completion, unmounted after the test. */
async function mount(element: ReactElement): Promise<void> {
  renderers.push(await ReactThreeTestRenderer.create(element));
}

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
  /** Left, right, bottom, top plane constants, in `localRectClipPlanes` order. */
  function constants(planes: readonly THREE.Plane[]): number[] {
    return planes.map((p) => p.constant);
  }

  function Harness({
    rect,
    world,
    scale = 1,
    inner = [0, 0],
    onPlanes,
  }: {
    rect: Rect2;
    world: [number, number];
    scale?: number;
    inner?: [number, number];
    onPlanes: (planes: readonly THREE.Plane[]) => void;
  }) {
    const { anchorRef, clippingPlanes } = useWorldClipPlanes(rect);
    useEffect(() => {
      onPlanes(clippingPlanes);
    }, [clippingPlanes, onPlanes]);
    return (
      <group position={[world[0], world[1], 0]} scale={[scale, scale, 1]}>
        <group position={[inner[0], inner[1], 0]}>
          <group ref={anchorRef} />
        </group>
      </group>
    );
  }

  it('quantizes a fractional clip rect the way Godot quantizes a scissor', async () => {
    let captured: readonly THREE.Plane[] = [];
    await mount(
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
    await mount(
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
    await mount(
      <Harness rect={{ x: 0, y: 20.5, w: 100, h: 100.5 }} world={[0, 0]} onPlanes={(p) => (captured = p)} />
    );
    // Godot space: round(20.5) = 21 and round(100.5) = 101, so the bottom edge
    // is 122. Rounding the +Y-up position (the BOTTOM, -121) instead would put
    // the top at 20 and the bottom at 121.
    expect(constants(captured)).toEqual([-0, 100, 122, -21]);
  });

  it('intersects an inherited rect before rounding, and publishes 4 planes, not 8', async () => {
    let captured: readonly THREE.Plane[] = [];
    await mount(
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
    await mount(
      <ControlClipProvider value={{ planes: [inherited], rect: null }}>
        <RotatedHarness />
      </ControlClipProvider>
    );
    expect(captured).toHaveLength(5);
    expect(captured[0]).toBe(inherited);
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
    await mount(
      <ControlClipProvider value={{ planes: inherited, rect: null }}>
        <Unanchored />
      </ControlClipProvider>
    );
    expect(captured).toBe(inherited);
  });
});
