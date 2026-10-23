/**
 * <SpringArm3D> draws the editor length line for every node, faint while unselected
 * (`spring_arm_3d_gizmo_plugin.cpp:35-54`), and keeps its children in the Node3D transform space
 * either way. Godot's gizmo is editor/scene/3d/gizmos/physics/spring_arm_3d_gizmo_plugin.cpp.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { SpringArm3D } from './Component';
import { parseSpringArm3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';
import { GizmoScene, lineOpacities } from '../../../../r3f/testing/GizmoScene';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

function armNode(props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Arm',
    type: 'SpringArm3D',
    children: [],
    properties: parseSpringArm3D(heading('SpringArm3D', { name: 'Arm' }), props),
  } as TscnNode;
}

async function renderArm(selectedPath: string | null, props: Record<string, string> = {}, showGizmos = true) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Arm" selectedPath={selectedPath} showGizmos={showGizmos}>
      <SpringArm3D node={armNode(props)}>
        <group name="Child" />
      </SpringArm3D>
    </GizmoScene>
  );
}

async function gizmoLine(props: Record<string, string>): Promise<THREE.LineSegments> {
  const renderer = await renderArm('Arm', props);
  const lines = renderer.scene.findAllByType('LineSegments');
  expect(lines).toHaveLength(1);
  return lines[0]!.instance as THREE.LineSegments;
}

async function gizmoPositions(props: Record<string, string>): Promise<number[]> {
  const line = await gizmoLine(props);
  return Array.from(line.geometry.getAttribute('position').array);
}

describe('<SpringArm3D> gizmo state', () => {
  it('draws the length line at the alpha of the collision colour, 0.42, when the node is selected', async () => {
    expect(lineOpacities(await renderArm('Arm'))).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the length line at 0.3 of that alpha, 0.126, when %s', async (_label, selectedPath) => {
    const [opacity] = lineOpacities(await renderArm(selectedPath));
    expect(opacity).toBeCloseTo(DEFAULT_COLLISION_DEBUG_COLOR.a * 0.3, 10);
  });

  it('draws no length line with the Gizmos toggle off, selected', async () => {
    const renderer = await renderArm('Arm', {}, false);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('keeps its children in the Node3D transform space, selected or not', async () => {
    for (const selected of [null, 'Arm']) {
      const renderer = await renderArm(selected);
      const group = renderer.scene.findByProps({ name: 'Arm' });
      expect(group.children.map((c) => c.props.name)).toContain('Child');
    }
  });
});

describe('<SpringArm3D> length line', () => {
  it.each([
    ['the authored length', { spring_length: '4.0' }, 4],
    ['a fractional length', { spring_length: '3.5' }, 3.5],
    ['a zero length, a zero-length segment as in Godot', { spring_length: '0.0' }, 0],
    ['a negative length, along -Z', { spring_length: '-2.0' }, -2],
    ["Godot's default 1 when the key is absent", {}, 1],
    ["Godot's default 1 when the key is unreadable", { spring_length: 'long' }, 1],
  ])('runs from the origin to (0, 0, length) for %s', async (_label, props, length) => {
    expect(await gizmoPositions(props)).toEqual([0, 0, 0, 0, 0, length]);
  });

  // Godot's end point is Vector3(0, 0, 1) * length = (nan, nan, ±inf) or (nan, nan, nan), and a
  // PRIMITIVE_LINES mesh with that vertex drew no pixel in a 4.6.3 render (24 of 24 lines absent,
  // against 4 of 8 finite control lines).
  it.each([['inf'], ['inf_neg'], ['nan']])(
    'draws no line for a spring_length of %s, as Godot does',
    async (literal) => {
      const renderer = await renderArm('Arm', { spring_length: literal });
      expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
    }
  );

  it('draws in the project collision colour', async () => {
    const line = await gizmoLine({});
    const material = line.material as THREE.LineBasicMaterial;
    const expected = godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR);
    expect(material.color.toArray()).toEqual(expected.toArray());
  });
});
