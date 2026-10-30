/**
 * The frame step behind Godot's 15-light cap (`renderer_canvas_render_rd.cpp:2380`): it measures
 * the rects of the items on a crowded placement and the rects of the positional lights, and hands
 * each item the lights it takes.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MAX_LIGHTS_PER_ITEM, MAX_LIGHTS_PER_RENDER } from '../../godot/rendering/rendering';
import { DEFAULT_LIGHT_CULL_KEY } from './lightCullKey';
import type { CanvasLightDeclaration, ItemPlacement } from './itemLightList';
import type { PassMesh } from './lightAccumulationPass';
import { capItemLights, type CappedItem } from './itemLightCap';
import { placementId } from './itemLightList';
import type { Rect2 } from '../../godot/math/rect2';

const CAP = MAX_LIGHTS_PER_ITEM - 1;

/** A viewport no light misses. */
const EVERYWHERE: Rect2 = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 };

const PLACEMENT: ItemPlacement = { lightMask: 1, z: 0, layer: 0, takenLights: null };

function positional(sequence: number | null): CanvasLightDeclaration {
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

function item(x = 0, layer = 0): SpiedItem {
  const geometry = new THREE.Object3D();
  geometry.add(quad(0));
  geometry.position.set(x, 0, 0);
  geometry.updateMatrixWorld();
  return {
    placement: { ...PLACEMENT, layer },
    geometry: { current: geometry },
    take: vi.fn<CappedItem['take']>(),
  };
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

  it("keeps the directional lights on the list it hands, which is the item's whole list", () => {
    const lit = item();
    const declared = lights(CAP + 2).set(1000, { ...positional(null), slot: 0 });
    step(declared, [lit], litQuads(CAP + 2));
    expect(lit.take).toHaveBeenCalledWith([...Array(CAP).keys(), 1000]);
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
    const capped = placementId({ ...PLACEMENT, takenLights: [...Array(CAP).keys()] });
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

/** A light past `MAX_LIGHTS_PER_RENDER` is off every item's list, and it does not count against the 15 an item takes. */
describe('capItemLights, past the lights of one render', () => {
  /** Light `n` of `count` sits at x = n * 100, so each light meets one item only. */
  const spread = (count: number) => litQuads(count, (ordinal) => ordinal * 100);

  /** `count` directional lights, ordinal `1000 + n` at slot `n`. */
  const directional = (count: number): Map<number, CanvasLightDeclaration> =>
    new Map(Array.from({ length: count }, (_, n) => [1000 + n, { ...positional(null), slot: n }]));

  const directionalOrdinals = (count: number) => Array.from({ length: count }, (_, n) => 1000 + n);

  const kept = (count: number) => [...Array(count).keys()];

  it('takes the first 256 positional lights by sequence, and no item lists the others', () => {
    const last = item(MAX_LIGHTS_PER_RENDER * 100);
    step(lights(MAX_LIGHTS_PER_RENDER + 1), [last], spread(MAX_LIGHTS_PER_RENDER + 1));
    expect(last.take).toHaveBeenCalledWith(kept(MAX_LIGHTS_PER_RENDER));
  });

  it('leaves the positional lights what the directional lights leave', () => {
    const lit = item();
    const declared = new Map([...lights(200), ...directional(100)]);
    step(declared, [lit], spread(200));
    expect(lit.take).toHaveBeenCalledWith([
      ...kept(MAX_LIGHTS_PER_RENDER - 100),
      ...directionalOrdinals(100),
    ]);
  });

  it('takes no positional light while the directional lights fill the render', () => {
    const lit = item();
    step(new Map([...lights(5), ...directional(MAX_LIGHTS_PER_RENDER + 20)]), [lit], spread(5));
    expect(lit.take).toHaveBeenCalledWith(directionalOrdinals(MAX_LIGHTS_PER_RENDER));
  });

  it('lists the first 256 directional lights by slot, not by ordinal', () => {
    const lit = item();
    const declared = directional(MAX_LIGHTS_PER_RENDER + 1);
    declared.set(1000, { ...declared.get(1000)!, slot: MAX_LIGHTS_PER_RENDER + 1 });
    step(declared, [lit], litQuads(0));
    expect(lit.take).toHaveBeenCalledWith(directionalOrdinals(MAX_LIGHTS_PER_RENDER + 1).slice(1));
  });

  /** The same light, handed to the canvas layers `layerMin` to `layerMax` (`range_layer_min` and `_max`). */
  const onLayers = (light: CanvasLightDeclaration, layerMin: number, layerMax: number) => ({
    ...light,
    reach: { ...light.reach, layerMin, layerMax },
  });

  const onLayerOnly = (declared: Map<number, CanvasLightDeclaration>, layer: number) =>
    new Map([...declared].map(([ordinal, light]) => [ordinal, onLayers(light, layer, layer)]));

  /** The lights of `declared`, ordinal, sequence and slot all `by` further on. */
  const shifted = (declared: Map<number, CanvasLightDeclaration>, by: number) =>
    new Map(
      [...declared].map(([ordinal, light]): [number, CanvasLightDeclaration] => [
        ordinal + by,
        light.sequence === null
          ? { ...light, slot: (light.slot ?? 0) + by }
          : { ...light, sequence: light.sequence + by },
      ])
    );

  // Godot hands each canvas the lights in range of its layer, and counts 256 over that list alone
  // (`renderer_viewport.cpp:667-690`).
  it('counts the lights of each canvas layer apart', () => {
    const world = item(0, 0);
    const hud = item(250 * 100, 1);
    const declared = new Map([...onLayerOnly(lights(200), 0), ...shifted(onLayerOnly(lights(100), 1), 200)]);
    step(declared, [world, hud], spread(300));
    expect(world.take).not.toHaveBeenCalled();
    expect(hud.take).not.toHaveBeenCalled();
  });

  it('leaves a layer the directional lights of other layers do not reach its whole budget', () => {
    const world = item(0, 0);
    const declared = new Map([...onLayerOnly(lights(200), 0), ...onLayerOnly(directional(100), 1)]);
    step(declared, [world], spread(200));
    expect(world.take).not.toHaveBeenCalled();
  });

  // The 256 are counted over the lights in range of a layer, so a light a layer does not reach
  // leaves room for the lights after it (`renderer_viewport.cpp:667-690`).
  it('counts the directional lights of each canvas layer apart', () => {
    const [world, hud] = [item(0, 0), item(0, 1)];
    const others = onLayerOnly(directional(200), 1);
    const shared = new Map(
      [...shifted(directional(100), 200)].map(([ordinal, light]) => [ordinal, onLayers(light, 0, 1)])
    );
    step(new Map([...others, ...shared]), [world, hud], litQuads(0));
    expect(world.take).not.toHaveBeenCalled();
    expect(hud.take).toHaveBeenCalledWith([
      ...directionalOrdinals(200),
      ...directionalOrdinals(300).slice(200, 256),
    ]);
  });

  it('does not count a light whose rect misses the viewport', () => {
    const lit = item();
    const inView: Rect2 = { x: -50, y: -50, w: 200 * 100, h: 100 };
    step(lights(MAX_LIGHTS_PER_RENDER + 1), [lit], spread(MAX_LIGHTS_PER_RENDER + 1), inView);
    expect(lit.take).not.toHaveBeenCalled();
  });
});
