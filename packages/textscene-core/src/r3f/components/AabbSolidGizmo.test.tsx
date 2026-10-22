/** <AabbSolidGizmo> fills a box with a faint colour, as Godot's `add_solid_box` does. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Aabb } from '../../godot/math/aabb';
import { godotColorToLinear } from '../godotColor';
import { AabbSolidGizmo } from './AabbSolidGizmo';

const COLOR = { r: 0.8, g: 0.7, b: 0.4 };

async function solid(aabb: Aabb, alpha = 0.016) {
  const renderer = await ReactThreeTestRenderer.create(
    <AabbSolidGizmo aabb={aabb} color={COLOR} alpha={alpha} />
  );
  return renderer.scene.findAllByType('Mesh').map((found) => found.instance as THREE.Mesh);
}

describe('<AabbSolidGizmo>', () => {
  it('covers the box: its centre and size', async () => {
    const [mesh] = await solid({ position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 4, z: 6 } });
    const bounds = new THREE.Box3().setFromObject(mesh!);
    expect(bounds.min.toArray()).toEqual([-1, 0, -1]);
    expect(bounds.max.toArray()).toEqual([1, 4, 5]);
  });

  it('draws in the colour given, converted to linear, at the alpha given', async () => {
    const [mesh] = await solid({ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } });
    const material = mesh!.material as THREE.MeshBasicMaterial;
    expect(material.color.toArray()).toEqual(godotColorToLinear(COLOR).toArray());
    expect(material.opacity).toBe(0.016);
  });

  it('blends over the scene, writes no depth and draws both sides in one pass', async () => {
    const [mesh] = await solid({ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } });
    const material = mesh!.material as THREE.MeshBasicMaterial;
    expect([
      material.transparent,
      material.depthWrite,
      material.side,
      material.forceSinglePass,
      material.fog,
    ]).toEqual([true, false, THREE.DoubleSide, true, false]);
  });

  it('draws nothing for a box with an infinite size', async () => {
    const meshes = await solid({ position: { x: 0, y: 0, z: 0 }, size: { x: Infinity, y: 1, z: 1 } });
    expect(meshes).toHaveLength(0);
  });
});
