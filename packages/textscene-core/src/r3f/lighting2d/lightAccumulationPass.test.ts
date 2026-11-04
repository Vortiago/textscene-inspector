/**
 * The list pre-passes: each list's buffer must hold its own lights and no other, from the right
 * seed, so an item reading it gets Godot's per-item loop (`canvas.glsl:727-830`).
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  renderLightLists,
  type AccumulationList,
  type LightAccumulationPass,
  type PassMesh,
} from './lightAccumulationPass';
import { createSeedMaterial } from './lightSeedQuad';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import type { LightListEntry, PassMeshRole } from './itemLightList';
import type { Rect2 } from '../../godot/math/rect2';

interface Draw {
  readonly target: THREE.WebGLRenderTarget | null;
  /** The layer of an array target the draw lands in. */
  readonly layer: number;
  readonly seed: [number, number, number];
  readonly visible: string[];
  readonly cameraMask: number;
  /** The target's scissor while it clips, else null. */
  readonly scissor: number[] | null;
  /** Whether the render updates the scene's world matrices first. */
  readonly updatesMatrices: boolean;
}

function passMesh(name: string, ordinal: number, role: PassMeshRole): PassMesh {
  const mesh = new THREE.Mesh();
  mesh.name = name;
  return { mesh, ordinal, role };
}

function list(
  entries: LightListEntry[],
  options: {
    plain?: boolean;
    lightOnly?: boolean;
    tint?: boolean;
    placementIds?: string[];
    /** Each entry's `shadow_color` layer, for a list kept apart. */
    apartTintLayers?: number[];
  } = {}
): AccumulationList {
  const tintLayers = options.apartTintLayers;
  const tintLayerCount = tintLayers?.filter((layer) => layer >= 0).length ?? 0;
  return {
    entries: new Map(entries.map((entry) => [entry.ordinal, entry])),
    placementIds: options.placementIds ?? ['uncapped'],
    target: (options.plain ?? true) ? new THREE.WebGLRenderTarget(1, 1) : null,
    lightOnlyTarget: options.lightOnly ? new THREE.WebGLRenderTarget(1, 1) : null,
    shadowTintTarget: options.tint ? new THREE.WebGLRenderTarget(1, 1) : null,
    apart: tintLayers
      ? {
          entries,
          tintLayers,
          tintLayerCount,
          target: new THREE.WebGLArrayRenderTarget(1, 1, entries.length),
          shadowTintTarget:
            tintLayerCount > 0 ? new THREE.WebGLArrayRenderTarget(1, 1, tintLayerCount) : null,
        }
      : null,
  };
}

/** Each of `count` entries kept apart, none of which adds a `shadow_color`. */
const untinted = (count: number) => new Array<number>(count).fill(-1);

function run(
  lists: AccumulationList[],
  meshes: PassMesh[],
  onRender?: () => void,
  windows: ReadonlyMap<string, Rect2> = new Map()
) {
  const draws: Draw[] = [];
  const seedMaterial = createSeedMaterial();
  const camera = new THREE.OrthographicCamera();
  const scene = new THREE.Scene();
  let target: THREE.WebGLRenderTarget | null = null;
  let layer = 0;
  const gl = {
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(4, 2),
    getRenderTarget: () => target,
    setRenderTarget: (next: THREE.WebGLRenderTarget | null, activeLayer = 0) => {
      target = next;
      layer = activeLayer;
    },
    render: () => {
      onRender?.();
      const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;
      draws.push({
        target,
        layer,
        seed: [seed.x, seed.y, seed.z],
        visible: meshes.filter(({ mesh }) => mesh.visible).map(({ mesh }) => mesh.name),
        cameraMask: camera.layers.mask,
        scissor: target?.scissorTest ? target.scissor.toArray() : null,
        updatesMatrices: scene.matrixWorldAutoUpdate,
      });
    },
  } as unknown as THREE.WebGLRenderer;
  const pass: LightAccumulationPass = {
    gl,
    scene,
    camera,
    lists,
    passMeshes: new Set(meshes),
    seedMaterial,
    canvasModulate: { r: 0.2, g: 0.3, b: 0.4 },
    resolution: new THREE.Vector2(),
    readBufferSize: (out) => gl.getDrawingBufferSize(out),
    windows,
  };
  return { draws, camera, scene, run: () => renderLightLists(pass), getTarget: () => target };
}

const SHADOWED = (ordinal: number): LightListEntry => ({ ordinal, unshadowed: false });

describe('renderLightLists', () => {
  it('draws each list with its own lights and no other', () => {
    const meshes = [passMesh('a', 0, 'lit'), passMesh('b', 1, 'lit')];
    const pass = run([list([SHADOWED(0)]), list([SHADOWED(0), SHADOWED(1)])], meshes);
    pass.run();
    expect(pass.draws.map((draw) => draw.visible)).toEqual([['a'], ['a', 'b']]);
  });

  it('draws the light pass layer alone', () => {
    const pass = run([list([SHADOWED(0)])], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws[0]!.cameraMask).toBe(1 << LIGHT_PASS_LAYER);
  });

  it('seeds the ordinary buffer from the canvas modulate', () => {
    const pass = run([list([SHADOWED(0)])], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws[0]!.seed.map((c) => c.toFixed(2))).toEqual(['0.20', '0.30', '0.40']);
  });

  it('seeds the Light Only buffer from white, over the same lights', () => {
    const lightOnly = list([SHADOWED(0)], { lightOnly: true });
    const pass = run([lightOnly], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws[1]).toMatchObject({
      target: lightOnly.lightOnlyTarget,
      seed: [1, 1, 1],
      visible: ['a'],
    });
  });

  it('draws the shadow_color buffer from black with the tint quads alone', () => {
    const tinted = list([SHADOWED(0)], { tint: true });
    const meshes = [passMesh('lit', 0, 'lit'), passMesh('tint', 0, 'tint')];
    const pass = run([tinted], meshes);
    pass.run();
    expect(pass.draws[1]).toMatchObject({
      target: tinted.shadowTintTarget,
      seed: [0, 0, 0],
      visible: ['tint'],
    });
  });

  it('draws each light of a list kept apart alone, into its own layer, from a black seed', () => {
    const apart = list([SHADOWED(1), SHADOWED(0)], { apartTintLayers: untinted(2) });
    const pass = run([apart], [passMesh('a', 0, 'lit'), passMesh('b', 1, 'lit')]);
    pass.run();
    expect(pass.draws.slice(1)).toMatchObject([
      { target: apart.apart!.target, layer: 0, seed: [0, 0, 0], visible: ['b'] },
      { target: apart.apart!.target, layer: 1, seed: [0, 0, 0], visible: ['a'] },
    ]);
  });

  it("draws each light kept apart into its own shadow_color layer, after the light's own layer", () => {
    const apart = list([SHADOWED(0)], { apartTintLayers: [0], tint: true });
    const meshes = [passMesh('lit', 0, 'lit'), passMesh('tint', 0, 'tint')];
    const pass = run([apart], meshes);
    pass.run();
    expect(pass.draws.slice(2)).toMatchObject([
      { target: apart.apart!.target, layer: 0, visible: ['lit'] },
      { target: apart.apart!.shadowTintTarget, layer: 0, seed: [0, 0, 0], visible: ['tint'] },
    ]);
  });

  it('draws a shadow_color layer only for each light kept apart that adds one', () => {
    const apart = list([SHADOWED(0), SHADOWED(1)], { plain: false, apartTintLayers: [-1, 0] });
    const meshes = [passMesh('lit0', 0, 'lit'), passMesh('lit1', 1, 'lit'), passMesh('tint1', 1, 'tint')];
    const pass = run([apart], meshes);
    pass.run();
    expect(pass.draws).toMatchObject([
      { target: apart.apart!.target, layer: 0, visible: ['lit0'] },
      { target: apart.apart!.target, layer: 1, visible: ['lit1'] },
      { target: apart.apart!.shadowTintTarget, layer: 0, visible: ['tint1'] },
    ]);
  });

  it('draws no ordinary buffer while no ordinary item reads the list', () => {
    const apart = list([SHADOWED(0)], { plain: false, apartTintLayers: untinted(1) });
    const pass = run([apart], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws.map((draw) => draw.target)).toEqual([apart.apart!.target]);
  });

  it("updates the scene's world matrices on the first draw alone, and restores the setting", () => {
    const pass = run([list([SHADOWED(0)], { lightOnly: true })], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws.map((draw) => draw.updatesMatrices)).toEqual([true, false]);
    expect(pass.scene.matrixWorldAutoUpdate).toBe(true);
  });

  it('sizes the layers to the drawing buffer and keeps one per light', () => {
    const apart = list([SHADOWED(0), SHADOWED(1)], { apartTintLayers: untinted(2) });
    run([apart], [passMesh('a', 0, 'lit')]).run();
    const { width, height, depth } = apart.apart!.target;
    expect([width, height, depth]).toEqual([4, 2, 2]);
  });

  it('sizes every buffer to the drawing buffer', () => {
    const only = list([SHADOWED(0)]);
    run([only], [passMesh('a', 0, 'lit')]).run();
    expect([only.target!.width, only.target!.height]).toEqual([4, 2]);
  });

  it("clips every buffer of a capped list to its items' window", () => {
    // The default camera views x and y in [-1, 1], drawn into the 4x2 buffer.
    const capped = list([SHADOWED(0)], { lightOnly: true, placementIds: ['capped'] });
    const windows = new Map([['capped', { x: 0.5, y: -1, w: 0.5, h: 2 }]]);
    const pass = run([capped], [passMesh('a', 0, 'lit')], undefined, windows);
    pass.run();
    expect(pass.draws.map((draw) => draw.scissor)).toEqual([
      [2, 0, 2, 2],
      [2, 0, 2, 2],
    ]);
  });

  it('draws a list whole while one of its placements has no window', () => {
    const shared = list([SHADOWED(0)], { placementIds: ['capped', 'uncapped'] });
    const windows = new Map([['capped', { x: 0.5, y: -1, w: 0.5, h: 2 }]]);
    const pass = run([shared], [passMesh('a', 0, 'lit')], undefined, windows);
    pass.run();
    expect(pass.draws[0]!.scissor).toBeNull();
  });

  it('draws nothing while no list exists', () => {
    const pass = run([], [passMesh('a', 0, 'lit')]);
    pass.run();
    expect(pass.draws).toEqual([]);
  });

  it('restores the render target and camera layers after a draw throws', () => {
    const pass = run([list([SHADOWED(0)])], [passMesh('a', 0, 'lit')], () => {
      throw new Error('context lost');
    });
    pass.camera.layers.set(0);
    expect(pass.run).toThrow('context lost');
    expect(pass.getTarget()).toBeNull();
    expect(pass.camera.layers.mask).toBe(1);
  });
});
