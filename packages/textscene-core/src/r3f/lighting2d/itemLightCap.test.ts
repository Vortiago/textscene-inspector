/**
 * The frame step behind Godot's 15-light cap: it measures the rects of the items on a crowded
 * placement and the rects of the positional lights, and hands each item the lights it takes.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MAX_LIGHTS_PER_ITEM } from '../../godot/rendering';
import { DEFAULT_LIGHT_CULL_KEY } from './lightCullKey';
import type { CanvasLightDeclaration, ItemPlacement } from './itemLightList';
import type { PassMesh } from './lightAccumulationPass';
import { capItemLights, type CappedItem } from './itemLightCap';
import { placementId } from './itemLightList';
import type { Rect2 } from '../../godot/rect2';

const CAP = MAX_LIGHTS_PER_ITEM - 1;

/** A viewport no light misses. */
const EVERYWHERE: Rect2 = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 };

const PLACEMENT: ItemPlacement = { lightMask: 1, z: 0, layer: 0, positionalLights: null };

function positional(sequence: number): CanvasLightDeclaration {
  return { reach: DEFAULT_LIGHT_CULL_KEY, sequence, shadowItemCullMask: null, tintsShadow: false };
}

/** `count` positional lights, ordinal `n` at sequence `n`. */
function lights(count: number): Map<number, CanvasLightDeclaration> {
  return new Map(Array.from({ length: count }, (_, n) => [n, positional(n)]));
}

/** A square quad of side 10 centred at `x`, in the world. */
function quad(x: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
  mesh.position.set(x, 0, 0);
  mesh.updateMatrixWorld();
  return mesh;
}

/** A lit quad for each light, light `n` centred at `x(n)`. */
function litQuads(count: number, x: (ordinal: number) => number = () => 0): Set<PassMesh> {
  return new Set(
    Array.from({ length: count }, (_, ordinal) => ({ mesh: quad(x(ordinal)), ordinal, role: 'lit' }))
  );
}

type SpiedItem = CappedItem & { take: ReturnType<typeof vi.fn<CappedItem['take']>> };

function item(x = 0): SpiedItem {
  const geometry = new THREE.Object3D();
  geometry.add(quad(0));
  geometry.position.set(x, 0, 0);
  geometry.updateMatrixWorld();
  return { placement: PLACEMENT, geometry: { current: geometry }, take: vi.fn<CappedItem['take']>() };
}

/**
 * Runs one frame, and returns a runner for the next, over the same lights or a new state, with the
 * windows the cap writes.
 */
function step(
  declared: Map<number, CanvasLightDeclaration>,
  items: CappedItem[],
  passMeshes: Set<PassMesh>,
  viewport: Rect2 = EVERYWHERE
) {
  const registered = new Map<CappedItem, readonly number[] | null>(items.map((item) => [item, null]));
  const windows = new Map<string, Rect2>();
  const run = (state: ReadonlyMap<number, CanvasLightDeclaration> = declared) =>
    capItemLights({ lights: state, items: registered, passMeshes, viewport, windows });
  run();
  return Object.assign(run, { windows });
}

describe('capItemLights', () => {
  it('hands no item anything while its placement holds 15 positional lights or fewer', () => {
    const lit = item();
    step(lights(CAP), [lit], litQuads(CAP));
    expect(lit.take).not.toHaveBeenCalled();
  });

  it('drops the lights that meet an item past the first 15 by sequence', () => {
    const lit = item();
    step(lights(CAP + 2), [lit], litQuads(CAP + 2));
    expect(lit.take).toHaveBeenCalledWith([...Array(CAP).keys()]);
  });

  it('measures each item, so items at one placement can hold different lists', () => {
    // Every light sits over the left item, and none over the right one.
    const left = item(0);
    const right = item(100);
    step(lights(CAP + 2), [left, right], litQuads(CAP + 2));
    expect(left.take).toHaveBeenCalledWith([...Array(CAP).keys()]);
    expect(right.take).not.toHaveBeenCalled();
  });

  it('measures a light by its unshadowed quad too', () => {
    const lit = item();
    const meshes = litQuads(CAP + 1);
    const first = [...meshes][0]!;
    meshes.delete(first);
    meshes.add({ ...first, mesh: quad(0), role: 'unshadowed' });
    step(lights(CAP + 1), [lit], meshes);
    expect(lit.take).toHaveBeenCalledWith([...Array(CAP).keys()]);
  });

  it('hands nothing again while the lights an item takes stay the same', () => {
    const lit = item();
    const again = step(lights(CAP + 1), [lit], litQuads(CAP + 1));
    again();
    expect(lit.take).toHaveBeenCalledTimes(1);
  });

  it('hands null back once the placement is no longer crowded', () => {
    const lit = item();
    const again = step(lights(CAP + 1), [lit], litQuads(CAP + 1));
    again(lights(CAP));
    expect(lit.take).toHaveBeenLastCalledWith(null);
  });

  it('leaves an item with no mounted geometry on its placement list', () => {
    const lit: SpiedItem = { ...item(), geometry: { current: null } };
    step(lights(CAP + 1), [lit], litQuads(CAP + 1));
    expect(lit.take).not.toHaveBeenCalled();
  });

  it('records the world rect the items of each capped list cover', () => {
    const left = item(-4);
    const right = item(4);
    const { windows } = step(lights(CAP + 1), [left, right], litQuads(CAP + 1));
    const capped = placementId({ ...PLACEMENT, positionalLights: [...Array(CAP).keys()] });
    expect([...windows]).toEqual([[capped, { x: -9, y: -5, w: 18, h: 10 }]]);
  });

  it('records no window for an item that reads its placement list', () => {
    const { windows } = step(lights(CAP), [item()], litQuads(CAP));
    expect(windows.size).toBe(0);
  });

  it('counts no light whose rect misses the viewport, as Godot culls it from the list', () => {
    // Light 0 meets the item at x 7..10 but lies past the viewport's right edge at 5.
    const lit = item(5);
    const quads = litQuads(CAP + 1, (ordinal) => (ordinal === 0 ? 12 : 0));
    step(lights(CAP + 1), [lit], quads, { x: -5, y: -5, w: 10, h: 10 });
    expect(lit.take).not.toHaveBeenCalled();
  });
});
