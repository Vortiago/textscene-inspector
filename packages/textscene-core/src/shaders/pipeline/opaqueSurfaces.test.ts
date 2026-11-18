import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { visibleSurfaces } from './opaqueSurfaces';

function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  view.position.set(0, 0, 5);
  view.updateMatrixWorld();
  return view;
}

function scene(...meshes: THREE.Mesh[]): THREE.Scene {
  const root = new THREE.Scene();
  root.add(...meshes);
  root.updateMatrixWorld();
  return root;
}

const box = () => new THREE.BoxGeometry();
const isAny = () => true;

describe('visibleSurfaces', () => {
  it('keeps each surface the filter keeps', () => {
    const kept = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(box(), kept);

    expect(visibleSurfaces(scene(mesh), camera(), (material) => material === kept)).toEqual([
      { mesh, material: kept, group: null },
    ]);
  });

  it('gives each draw group whose material the mesh holds its own surface', () => {
    const geometry = box();
    const mesh = new THREE.Mesh(geometry, [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);

    expect(visibleSurfaces(scene(mesh), camera(), isAny).map((s) => s.group)).toEqual(
      geometry.groups.slice(0, 2)
    );
  });

  it('skips a mesh outside the frustum', () => {
    const mesh = new THREE.Mesh(box(), new THREE.MeshBasicMaterial());
    mesh.position.set(0, 0, 50);

    expect(visibleSurfaces(scene(mesh), camera(), isAny)).toEqual([]);
  });

  it('skips a mesh outside the camera layers', () => {
    const mesh = new THREE.Mesh(box(), new THREE.MeshBasicMaterial());
    mesh.layers.set(3);

    expect(visibleSurfaces(scene(mesh), camera(), isAny)).toEqual([]);
  });

  it('skips a hidden mesh (edge case)', () => {
    const mesh = new THREE.Mesh(box(), new THREE.MeshBasicMaterial());
    mesh.visible = false;

    expect(visibleSurfaces(scene(mesh), camera(), isAny)).toEqual([]);
  });
});
