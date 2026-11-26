import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LightPassInputs, type LightPassFrame } from './lightPassInputs';
import type { AccumulationList, PassMesh } from './lightAccumulationPass';

function lightMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Vector3(1, 1, 1) } } });
  return new THREE.Mesh(new THREE.PlaneGeometry(), material);
}

function frameOf(mesh: THREE.Object3D = lightMesh()): LightPassFrame {
  const passMesh: PassMesh = { mesh, ordinal: 0, role: 'lit' };
  const lists: AccumulationList[] = [];
  return {
    camera: new THREE.OrthographicCamera(),
    lists,
    passMeshes: new Set([passMesh]),
    canvasModulate: { r: 1, g: 1, b: 1 },
    resolution: new THREE.Vector2(4, 2),
    windows: new Map(),
  };
}

/** Draws `frame` once, applies `change`, and answers whether the second call drew. */
function drawsAfter(frame: LightPassFrame, change: () => void): boolean {
  const inputs = new LightPassInputs();
  inputs.drawIfChanged(frame, () => {});
  change();
  const draw = vi.fn();
  inputs.drawIfChanged(frame, draw);
  return draw.mock.calls.length === 1;
}

describe('LightPassInputs.drawIfChanged', () => {
  it('skips the draw of a frame that reads as the kept frame', () => {
    expect(drawsAfter(frameOf(), () => {})).toBe(false);
  });

  it('keeps nothing after a draw that throws', () => {
    const inputs = new LightPassInputs();
    const frame = frameOf();
    expect(() =>
      inputs.drawIfChanged(frame, () => {
        throw new Error('context lost');
      })
    ).toThrow('context lost');
    const draw = vi.fn();
    inputs.drawIfChanged(frame, draw);
    expect(draw).toHaveBeenCalledOnce();
  });

  it('draws again when a material is hidden, which bumps no version', () => {
    const mesh = lightMesh();
    expect(drawsAfter(frameOf(mesh), () => (mesh.material.visible = false))).toBe(true);
  });

  it("draws again when a mesh's draw range shrinks", () => {
    const mesh = lightMesh();
    expect(drawsAfter(frameOf(mesh), () => mesh.geometry.setDrawRange(0, 3))).toBe(true);
  });

  it('draws again when a mesh leaves the light pass layer', () => {
    const mesh = lightMesh();
    expect(drawsAfter(frameOf(mesh), () => mesh.layers.set(2))).toBe(true);
  });

  it('draws every frame for a mesh with a material array', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), [new THREE.MeshBasicMaterial()]);
    expect(drawsAfter(frameOf(mesh), () => {})).toBe(true);
  });
});

describe('LightPassInputs.forget', () => {
  it('makes the next frame draw', () => {
    const inputs = new LightPassInputs();
    const frame = frameOf();
    inputs.drawIfChanged(frame, () => {});
    inputs.forget();
    const draw = vi.fn();
    inputs.drawIfChanged(frame, draw);
    expect(draw).toHaveBeenCalledOnce();
  });

  it('leaves a frame with nothing kept to draw', () => {
    const inputs = new LightPassInputs();
    inputs.forget();
    const draw = vi.fn();
    inputs.drawIfChanged(frameOf(), draw);
    expect(draw).toHaveBeenCalledOnce();
  });
});
