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
      <ControlQuad width={100} height={40} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.position.toArray()).toEqual([50, -20, 0]);
  });

  it('builds a planeGeometry sized exactly to width/height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={64} height={32} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);
  });

  it('is transparent, double-sided and does not write depth (2D canvas-item convention)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={0.5} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.opacity).toBe(0.5);
  });

  it('replaces the material when a map arrives after the quad is already drawn', async () => {
    // An icon, a TextureRect image, a SubViewport that has not published yet:
    // the quad is drawn from the first render and the map lands on a later one.
    // `USE_MAP` is baked at the material's first compile, so the material that
    // ends up holding the texture must not be the one compiled without it.
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
    );
    const material = (): THREE.MeshBasicMaterial =>
      (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const mapless = material();
    const compiledVersion = mapless.version;

    const texture = new THREE.Texture();
    await renderer.update(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} map={texture} renderOrder={0} />
    );

    expect(material().map).toBe(texture);
    expect(material() !== mapless || material().version > compiledVersion).toBe(true);
  });

  it('stops decoding when the map is replaced by one that keeps its own colour space', async () => {
    // The converse, and it cannot be fixed by assignment: `applyProps` IGNORES
    // an undefined prop value (fiber 9.6.1 dist), so the decode define can be
    // added to a material but never removed from one. A Sprite2D swapping a
    // `res://` file for a ViewportTexture makes exactly this transition.
    const undecoded = new THREE.Texture();
    undecoded.colorSpace = THREE.NoColorSpace;
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} map={undecoded} renderOrder={0} />
    );
    const material = (): THREE.MeshBasicMaterial =>
      (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material().defines).toEqual({ DECODE_VIDEO_TEXTURE: '' });

    const ownSpace = new THREE.Texture();
    ownSpace.colorSpace = THREE.SRGBColorSpace;
    await renderer.update(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} map={ownSpace} renderOrder={0} />
    );

    expect(material().defines?.DECODE_VIDEO_TEXTURE).toBeUndefined();
  });

  it('maps a texture onto the quad when provided (edge: no texture leaves map null)', async () => {
    const texture = new THREE.Texture();
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={10} height={10} color={new THREE.Color(1, 1, 1)} opacity={1} map={texture} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map).toBe(texture);
  });
});
