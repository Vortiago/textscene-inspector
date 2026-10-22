/** <AabbGizmo> draws the 12 edges of a box, in the Godot colour it is given. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Aabb } from '../../godot/math/aabb';
import { godotColorToLinear } from '../godotColor';
import { AabbGizmo } from './AabbGizmo';

const COLOR = { r: 0.8, g: 0.7, b: 0.4 };

async function line(aabb: Aabb) {
  const renderer = await ReactThreeTestRenderer.create(<AabbGizmo aabb={aabb} color={COLOR} />);
  return renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
}

describe('<AabbGizmo>', () => {
  it('draws the edges in the order of AABB::get_edge', async () => {
    const drawn = await line({ position: { x: -1, y: 0, z: -1 }, size: { x: 2, y: 3, z: 2 } });
    expect(Array.from(drawn.geometry.getAttribute('position').array).slice(0, 12)).toEqual([
      1, 0, -1, -1, 0, -1, 1, 0, 1, 1, 0, -1,
    ]);
  });

  it('draws in the colour given, converted to linear', async () => {
    const drawn = await line({ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } });
    expect((drawn.material as THREE.LineBasicMaterial).color.toArray()).toEqual(
      godotColorToLinear(COLOR).toArray()
    );
  });
});
