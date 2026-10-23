/** <AabbAxesGizmo> draws a box as Godot's CPUParticles3D and VisibleOnScreenNotifier3D gizmos do. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Aabb } from '../../godot/math/aabb';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { godotColorToLinear } from '../godotColor';
import { AabbAxesGizmo } from './AabbAxesGizmo';

const COLOR = { r: 0.8, g: 0.5, b: 0.7 };
const BOX: Aabb = { position: { x: -1, y: -1, z: -1 }, size: { x: 2, y: 2, z: 2 } };

async function render(variant: GizmoVariant = 'selected') {
  const renderer = await ReactThreeTestRenderer.create(
    <AabbAxesGizmo aabb={BOX} color={COLOR} solidAlpha={0.1} variant={variant} />
  );
  return {
    lines: renderer.scene.findAllByType('LineSegments').map((found) => found.instance as THREE.LineSegments),
    fills: renderer.scene.findAllByType('Mesh').map((found) => found.instance as THREE.Mesh),
  };
}

describe('<AabbAxesGizmo>', () => {
  it('draws the 12 edges, then the three unit axes from the centre, in the colour given', async () => {
    const { lines } = await render();
    expect(lines.map((line) => line.geometry.getAttribute('position').count)).toEqual([24, 6]);
    expect(Array.from(lines[1]!.geometry.getAttribute('position').array)).toEqual([
      ...[0, 0, 0, 1, 0, 0],
      ...[0, 0, 0, 0, 1, 0],
      ...[0, 0, 0, 0, 0, 1],
    ]);
    for (const line of lines) {
      expect((line.material as THREE.LineBasicMaterial).color.toArray()).toEqual(
        godotColorToLinear(COLOR).toArray()
      );
    }
  });

  it('fills the box at the alpha given, in the same colour', async () => {
    const { fills } = await render();
    const material = fills[0]!.material as THREE.MeshBasicMaterial;
    expect([fills, material.opacity, material.color.toArray()]).toEqual([
      [expect.anything()],
      0.1,
      godotColorToLinear(COLOR).toArray(),
    ]);
  });

  it('draws the edges and the axes of an unselected box at 0.3 of the colour alpha', async () => {
    const { lines } = await render('unselected');
    expect(lines.map((line) => (line.material as THREE.LineBasicMaterial).opacity)).toEqual([0.3, 0.3]);
  });

  it('adds the fill only to a selected box, as Godot adds its solid box only when selected', async () => {
    expect(
      [(await render('selected')).fills, (await render('unselected')).fills].map((f) => f.length)
    ).toEqual([1, 0]);
  });
});
