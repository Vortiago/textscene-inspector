/**
 * `<ControlQuad>` is the shared quad primitive every Control painter draws
 * chrome with — the Control-space analogue of Sprite2D's `QuadMesh`
 * (`nodes/2d/sprite2d/Component.tsx`): centred at `[w/2, -h/2, 0]` so a
 * caller sizes/positions it purely from the solved rect's `(w, h)`, with the
 * same transparent / no-depth-write / double-sided material contract.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { ControlQuad } from './controlQuad';

describe('<ControlQuad>', () => {
  it('centres the mesh at (w/2, -h/2, 0) for the given rect size', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={100} height={40} color={new THREE.Color(1, 1, 1)} opacity={1} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.position.toArray()).toEqual([50, -20, 0]);
  });

  it('builds a planeGeometry sized exactly to width/height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={64} height={32} color={new THREE.Color(1, 1, 1)} opacity={1} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);
  });

  it('is transparent, double-sided and does not write depth (2D canvas-item convention)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={0.5} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.opacity).toBe(0.5);
  });

  it('maps a texture onto the quad when provided (edge: no texture leaves map null)', async () => {
    const texture = new THREE.Texture();
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} map={texture} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map).toBe(texture);
  });
});
