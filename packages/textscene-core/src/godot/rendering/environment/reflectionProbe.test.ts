import { describe, expect, it } from 'vitest';
import { captureFarPlanes, reflectionAtlasLayout, reflectionProbeOrder } from './reflectionProbe';

const ZERO = { x: 0, y: 0, z: 0 };

describe('captureFarPlanes', () => {
  it('reaches each face of the box from its centre, in the face order +X, -X, +Y, -Y, +Z, -Z', () => {
    expect(captureFarPlanes({ x: 2, y: 6, z: 20 }, ZERO, 0)).toEqual([1, 1, 3, 3, 10, 10]);
  });

  it('measures each face from the origin offset', () => {
    expect(captureFarPlanes({ x: 2, y: 6, z: 20 }, { x: 0.5, y: 0, z: 0 }, 0)).toEqual([
      0.5, 1.5, 3, 3, 10, 10,
    ]);
  });

  it('keeps the farthest plane of the faces before, as Godot reuses one distance', () => {
    expect(captureFarPlanes({ x: 20, y: 6, z: 20 }, ZERO, 0)).toEqual([10, 10, 10, 10, 10, 10]);
  });

  it('reaches at least max_distance on every face', () => {
    expect(captureFarPlanes({ x: 2, y: 6, z: 20 }, ZERO, 30)).toEqual([30, 30, 30, 30, 30, 30]);
  });

  it('draws nothing past the near plane for a box of size 0 (edge case)', () => {
    expect(captureFarPlanes(ZERO, ZERO, 0)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('reflectionAtlasLayout', () => {
  it('lays out an atlas of update-once probes as eight layers, 768 wide with a 128-texel border', () => {
    const layout = reflectionAtlasLayout(false);
    expect(layout.size).toBe(768);
    expect(layout.borderSize).toBeCloseTo(1 - 256 / 768, 9);
    expect(layout.layerSizes).toEqual([768, 384, 192, 96, 48, 24, 12, 6]);
    expect(layout.downsampledSizes).toEqual([384, 192, 96, 48, 24, 12, 6]);
  });

  it('lays out an atlas that holds an update-always probe as seven layers, 640 wide', () => {
    const layout = reflectionAtlasLayout(true);
    expect(layout.size).toBe(640);
    expect(layout.borderSize).toBeCloseTo(0.8, 9);
    expect(layout.layerSizes).toEqual([640, 320, 160, 80, 40, 20, 10]);
  });
});

describe('reflectionProbeOrder', () => {
  it('puts the largest box first, so the shader, which starts from the last, takes the smallest first', () => {
    const small = { size: { x: 2, y: 2, z: 2 } };
    const large = { size: { x: 20, y: 20, z: 20 } };
    const middle = { size: { x: 8, y: 1, z: 8 } };
    expect(reflectionProbeOrder([small, large, middle])).toEqual([large, middle, small]);
  });

  it('puts the first of two equal boxes in the tree last, so the shader takes it first (edge case)', () => {
    const first = { size: { x: 20, y: 6, z: 20 } };
    const second = { size: { x: 20, y: 6, z: 20 } };
    const order = reflectionProbeOrder([first, second]);
    expect(order[0]).toBe(second);
    expect(order[1]).toBe(first);
  });

  it("orders more than 16 probes with equal boxes as Godot's unstable sort does (edge case)", () => {
    // Godot sorts the probes in reverse tree order. There, large and small boxes alternate, and
    // Godot 4.6.3's `SortArray` leaves that pattern in this order (`sortArray.godot.json`).
    const godotOrder = [18, 16, 14, 12, 10, 8, 6, 4, 2, 0, 7, 5, 9, 11, 3, 13, 15, 1, 17, 19];
    const count = godotOrder.length;
    const reversePosition = (treeIndex: number) => count - 1 - treeIndex;
    const probes = Array.from({ length: count }, (_, treeIndex) => {
      const edge = reversePosition(treeIndex) % 2 === 0 ? 20 : 2;
      return { treeIndex, size: { x: edge, y: edge, z: edge } };
    });
    const order = reflectionProbeOrder(probes).map(({ treeIndex }) => treeIndex);
    expect(order).toEqual(godotOrder.map(reversePosition));
  });

  it('orders by the diagonal, not the volume (edge case)', () => {
    const flat = { size: { x: 30, y: 0.1, z: 0.1 } };
    const cube = { size: { x: 10, y: 10, z: 10 } };
    expect(reflectionProbeOrder([cube, flat])).toEqual([flat, cube]);
  });
});
