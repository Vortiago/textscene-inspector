/** <GizmoMesh> draws a geometry as a faint unlit fill above the scene, as Godot's gizmo materials do. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { isEditorHelper } from '../editorHelpers';
import { GizmoMesh } from './GizmoMesh';

const COLOR = new THREE.Color(0.2, 0.4, 0.6);

async function render(geometry: THREE.BufferGeometry | null) {
  return ReactThreeTestRenderer.create(<GizmoMesh geometry={geometry} color={COLOR} alpha={0.25} />);
}

describe('<GizmoMesh>', () => {
  it('draws the geometry given, in the colour and at the opacity given', async () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const renderer = await render(geometry);
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect([mesh.geometry, material.color.toArray(), material.opacity]).toEqual([
      geometry,
      COLOR.toArray(),
      0.25,
    ]);
  });

  it('blends over the scene, writes no depth and draws both sides in one pass', async () => {
    const renderer = await render(new THREE.BoxGeometry(1, 1, 1));
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect([
      material.transparent,
      material.depthWrite,
      material.side,
      material.forceSinglePass,
      material.fog,
    ]).toEqual([true, false, THREE.DoubleSide, true, false]);
  });

  it('marks its group as editor chrome', async () => {
    const renderer = await render(new THREE.BoxGeometry(1, 1, 1));
    const group = renderer.scene.findByType('Mesh').parent!.instance as THREE.Object3D;
    expect(isEditorHelper(group)).toBe(true);
  });

  it('draws nothing without a geometry', async () => {
    const renderer = await render(null);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('disposes the geometry once it unmounts', async () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    let disposed = false;
    geometry.addEventListener('dispose', () => (disposed = true));
    const renderer = await render(geometry);
    await renderer.unmount();
    await Promise.resolve();
    expect(disposed).toBe(true);
  });

  it('shades by vertex, with each vertex alpha, when the geometry has a colour attribute', async () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 4));
    const renderer = await render(geometry);
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((mesh.material as THREE.MeshBasicMaterial).vertexColors).toBe(true);
  });

  it('draws one colour when the geometry has no colour attribute', async () => {
    const renderer = await render(new THREE.BoxGeometry(1, 1, 1));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((mesh.material as THREE.MeshBasicMaterial).vertexColors).toBe(false);
  });
});
