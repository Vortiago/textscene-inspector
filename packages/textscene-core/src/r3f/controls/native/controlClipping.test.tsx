/**
 * `controlClipping` carries the accumulated canvas clip down the native Control
 * tree — a verified spike established that clip PLANES, not stencil, are
 * correct here: the on-screen 2D canvas requests no stencil buffer at all, so a
 * stencil-based clip would be a silent no-op. The clip is a RECT first, because
 * Godot's `final_clip_rect` is one rect that becomes one scissor, intersected
 * with the enclosing clipper's and then rounded — position and size
 * INDEPENDENTLY, which is the whole reason the rect travels alongside the
 * planes. These tests pin the seam: default-empty, inheritance through the
 * provider, the three pure steps (world rect, intersection, quantization), the
 * rect-to-planes conversion, and the hook that composes them.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import {
  ControlClipProvider,
  NO_CONTROL_CLIP,
  intersectClipRects,
  localRectClipPlanes,
  quantizeClipRect,
  useControlClipPlanes,
  useWorldClipPlanes,
  withAdditionalClipPlanes,
  worldClipRect,
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
      <ControlClipProvider value={{ planes: [plane], rect: null }}>{children}</ControlClipProvider>
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

describe('worldClipRect', () => {
  const rect: Rect2 = { x: 0, y: 0, w: 322, h: 195 };

  function matrix(position: [number, number], scale: number): THREE.Matrix4 {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(position[0], position[1], 0),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, 1)
    );
  }

  it('returns the rect unchanged under an identity transform', () => {
    expect(worldClipRect({ x: 100, y: 50, w: 200, h: 80 }, new THREE.Matrix4())).toEqual({
      x: 100,
      y: 50,
      w: 200,
      h: 80,
    });
  });

  it('resolves a scaled, translated anchor into absolute canvas pixels (+Y down)', () => {
    // The world group sits at Godot (600, 340); the anchor at local (79, 17)
    // scaled 1.25 lands at 600 + 98.75 and 340 + 21.25.
    const m = matrix([600, -340], 1.25).multiply(
      new THREE.Matrix4().makeTranslation(79, -17, 0)
    );
    expect(worldClipRect(rect, m)).toEqual({ x: 698.75, y: 361.25, w: 402.5, h: 243.75 });
  });

  it('takes the corner extent under a mirrored scale rather than a negative size', () => {
    const mirrored = new THREE.Matrix4().compose(
      new THREE.Vector3(500, -100, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(-1, 1, 1)
    );
    expect(worldClipRect({ x: 0, y: 0, w: 40, h: 20 }, mirrored)).toEqual({
      x: 460,
      y: 100,
      w: 40,
      h: 20,
    });
  });

  it('returns null when the transform rotates (error: no axis-aligned rect to quantize)', () => {
    const rotated = new THREE.Matrix4().makeRotationZ(0.3);
    expect(worldClipRect(rect, rotated)).toBeNull();
  });

  it('still resolves a rotation that is an exact multiple of a quarter turn', () => {
    const quarter = new THREE.Matrix4().makeRotationZ(Math.PI);
    const resolved = worldClipRect({ x: 0, y: 0, w: 40, h: 20 }, quarter);
    expect(resolved).not.toBeNull();
    expect(resolved!.x).toBeCloseTo(-40);
    expect(resolved!.y).toBeCloseTo(-20);
    expect(resolved!.w).toBeCloseTo(40);
    expect(resolved!.h).toBeCloseTo(20);
  });
});

describe('intersectClipRects', () => {
  it('narrows to the overlap', () => {
    expect(intersectClipRects({ x: 0, y: 0, w: 100, h: 100 }, { x: 40, y: 10, w: 100, h: 30 })).toEqual({
      x: 40,
      y: 10,
      w: 60,
      h: 30,
    });
  });

  it('collapses to zero when the rects only touch (Rect2::intersects is strict)', () => {
    expect(intersectClipRects({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 50, h: 50 })).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    });
  });

  it('collapses to zero when they miss entirely', () => {
    expect(intersectClipRects({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 })).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    });
  });
});

describe('quantizeClipRect', () => {
  it('rounds position and size SEPARATELY, so the far edge is round(pos) + round(size)', () => {
    // renderer_canvas_cull.cpp: round(698.75) + round(402.5) = 699 + 403 = 1102,
    // a whole column past round(698.75 + 402.5) = 1101.
    const quantized = quantizeClipRect({ x: 698.75, y: 361.25, w: 402.5, h: 243.75 });
    expect(quantized).toEqual({ x: 699, y: 361, w: 403, h: 244 });
    expect(quantized.x + quantized.w).toBe(1102);
  });

  it('leaves a whole-pixel origin agreeing with a rounded edge for every size fraction', () => {
    for (const [w, edge] of [
      [500.25, 520],
      [500.5, 521],
      [500.75, 521],
    ]) {
      const quantized = quantizeClipRect({ x: 20, y: 20, w: w!, h: 10 });
      expect(quantized.x + quantized.w).toBe(edge);
    }
  });

  it('rounds halves AWAY FROM ZERO, not up (edge: a clipper hanging off the canvas)', () => {
    // JavaScript's Math.round(-10.5) is -10; std::round's is -11.
    expect(quantizeClipRect({ x: -10.5, y: -0.5, w: 5.5, h: 2.5 })).toEqual({
      x: -11,
      y: -1,
      w: 6,
      h: 3,
    });
  });

  it('collapses a sub-half-pixel size to nothing (edge: Godot skips the item outright)', () => {
    expect(quantizeClipRect({ x: 10, y: 10, w: 0.4, h: 0.4 })).toEqual({ x: 10, y: 10, w: 0, h: 0 });
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
    // right edge x = 1102, bottom edge Godot y = 605 i.e. world y = -605.
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
      <Harness
        rect={{ x: 0, y: 20.5, w: 100, h: 100.5 }}
        world={[0, 0]}
        onPlanes={(p) => (captured = p)}
      />
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

  it('exposes an empty clip as the module-level default', () => {
    expect(NO_CONTROL_CLIP).toEqual({ planes: [], rect: null });
  });
});
