import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneHasBlendedSurface } from './alphaPassScan';

function mesh(material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

function sceneOf(...objects: THREE.Object3D[]): THREE.Scene {
  const scene = new THREE.Scene();
  for (const object of objects) scene.add(object);
  return scene;
}

function opaque(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial();
}

function blended(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial();
  material.transparent = true;
  return material;
}

describe('sceneHasBlendedSurface', () => {
  it('is false for an empty scene', () => {
    expect(sceneHasBlendedSurface(sceneOf())).toBe(false);
  });

  it('is false for a scene of opaque meshes', () => {
    expect(sceneHasBlendedSurface(sceneOf(mesh(opaque()), mesh(opaque())))).toBe(false);
  });

  it('finds a material three will blend', () => {
    expect(sceneHasBlendedSurface(sceneOf(mesh(opaque()), mesh(blended())))).toBe(true);
  });

  it('counts an opaque material carrying a non-normal blend', () => {
    // Godot agrees: `blend_mode_uses_blend_alpha` puts ADD/SUB/MUL/PREMULT in the
    // alpha pass whatever `transparency` says.
    const additive = opaque();
    additive.blending = THREE.AdditiveBlending;
    expect(sceneHasBlendedSurface(sceneOf(mesh(additive)))).toBe(true);
  });

  it('ignores a transparent material with blending switched off entirely', () => {
    const unblended = blended();
    unblended.blending = THREE.NoBlending;
    expect(sceneHasBlendedSurface(sceneOf(mesh(unblended)))).toBe(false);
  });

  it('finds one nested deep in the graph', () => {
    const inner = new THREE.Group();
    inner.add(mesh(blended()));
    const outer = new THREE.Group();
    outer.add(inner);
    expect(sceneHasBlendedSurface(sceneOf(outer))).toBe(true);
  });

  it('finds one in any slot of a multi-material mesh', () => {
    expect(
      sceneHasBlendedSurface(
        sceneOf(new THREE.Mesh(new THREE.BufferGeometry(), [opaque(), blended()]))
      )
    ).toBe(true);
  });

  it('reads a material bag that is neither a Material nor an array (error path)', () => {
    // r3f leaves `material` undefined on every non-mesh object it wraps.
    const bare = new THREE.Object3D();
    expect(sceneHasBlendedSurface(sceneOf(bare, new THREE.Group()))).toBe(false);
  });
});
