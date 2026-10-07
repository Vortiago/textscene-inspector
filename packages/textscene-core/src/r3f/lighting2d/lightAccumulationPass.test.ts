/**
 * The list pre-passes: each list's buffer must hold its own lights and no other, from the right
 * seed, so an item reading it gets Godot's per-item loop (`canvas.glsl:727-830`).
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { renderLightLists, type AccumulationList, type PassMesh } from './lightAccumulationPass';
import { createSeedMaterial } from './lightSeedQuad';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import type { LightListEntry, PassMeshRole } from './itemLightList';

interface Draw {
  readonly target: THREE.WebGLRenderTarget | null;
  readonly seed: [number, number, number];
  readonly visible: string[];
  readonly cameraMask: number;
}

function passMesh(name: string, ordinal: number, role: PassMeshRole): PassMesh {
  const mesh = new THREE.Mesh();
  mesh.name = name;
  return { mesh, ordinal, role };
}

function list(
  entries: LightListEntry[],
  options: { lightOnly?: boolean; tint?: boolean } = {}
): AccumulationList {
  return {
    entries: new Map(entries.map((entry) => [entry.ordinal, entry])),
    target: new THREE.WebGLRenderTarget(1, 1),
    lightOnlyTarget: options.lightOnly ? new THREE.WebGLRenderTarget(1, 1) : null,
    shadowTintTarget: options.tint ? new THREE.WebGLRenderTarget(1, 1) : null,
  };
}

function run(lists: AccumulationList[], meshes: PassMesh[], onRender?: () => void) {
  const draws: Draw[] = [];
  const seedMaterial = createSeedMaterial();
  const camera = new THREE.OrthographicCamera();
  let target: THREE.WebGLRenderTarget | null = null;
  const gl = {
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(4, 2),
    getRenderTarget: () => target,
    setRenderTarget: (next: THREE.WebGLRenderTarget | null) => {
      target = next;
    },
    clear: () => {},
    render: () => {
      onRender?.();
      const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;
      draws.push({
        target,
        seed: [seed.x, seed.y, seed.z],
        visible: meshes.filter(({ mesh }) => mesh.visible).map(({ mesh }) => mesh.name),
        cameraMask: camera.layers.mask,
      });
    },
  } as unknown as THREE.WebGLRenderer;
  const pass = {
    gl,
    scene: new THREE.Scene(),
    camera,
    lists,
    passMeshes: new Set(meshes),
    seedMaterial,
    canvasModulate: { r: 0.2, g: 0.3, b: 0.4 },
    resolution: new THREE.Vector2(),
  };
  return { draws, camera, run: () => renderLightLists(pass), getTarget: () => target };
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

  it('draws the shadow_color buffer from black with the volumes and tint quads alone', () => {
    const tinted = list([SHADOWED(0)], { tint: true });
    const meshes = [passMesh('volume', 0, 'volume'), passMesh('lit', 0, 'lit'), passMesh('tint', 0, 'tint')];
    const pass = run([tinted], meshes);
    pass.run();
    expect(pass.draws[1]).toMatchObject({
      target: tinted.shadowTintTarget,
      seed: [0, 0, 0],
      visible: ['volume', 'tint'],
    });
  });

  it('sizes every buffer to the drawing buffer', () => {
    const only = list([SHADOWED(0)]);
    run([only], [passMesh('a', 0, 'lit')]).run();
    expect([only.target.width, only.target.height]).toEqual([4, 2]);
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
