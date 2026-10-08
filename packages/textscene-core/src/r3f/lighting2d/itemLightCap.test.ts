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

const CAP = MAX_LIGHTS_PER_ITEM - 1;

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

function step(declared: Map<number, CanvasLightDeclaration>, items: CappedItem[], passMeshes: Set<PassMesh>) {
  const handed = new WeakMap<CappedItem, readonly number[] | null>();
  const run = () => capItemLights({ lights: declared, items: new Set(items), passMeshes, handed });
  run();
  return run;
}

describe('capItemLights', () => {
  it('hands no item anything while its placement holds 15 positional lights or fewer', () => {
    const lit = item();
    step(lights(CAP), [lit], litQuads(CAP));
    expect(lit.take).not.toHaveBeenCalled();
  });

  it('hands an item on a crowded placement the first 15 lights by sequence', () => {
    const lit = item();
    step(lights(CAP + 2), [lit], litQuads(CAP + 2));
    expect(lit.take).toHaveBeenCalledWith([...Array(CAP).keys()]);
  });

  it('measures each item, so items at one placement can take different lights', () => {
    // Light 0 sits over the left item only, so the right item takes light 15 in its place.
    const left = item(-20);
    const right = item(0);
    step(
      lights(CAP + 1),
      [left, right],
      litQuads(CAP + 1, (ordinal) => (ordinal === 0 ? -20 : 0))
    );
    expect(left.take).toHaveBeenCalledWith([0]);
    expect(right.take).toHaveBeenCalledWith([...Array(CAP).keys()].map((n) => n + 1));
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
    const declared = lights(CAP + 1);
    const again = step(declared, [lit], litQuads(CAP + 1));
    declared.delete(CAP);
    again();
    expect(lit.take).toHaveBeenLastCalledWith(null);
  });

  it('gives an item with no mounted geometry no positional light', () => {
    const lit: SpiedItem = { ...item(), geometry: { current: null } };
    step(lights(CAP + 1), [lit], litQuads(CAP + 1));
    expect(lit.take).toHaveBeenCalledWith([]);
  });
});
