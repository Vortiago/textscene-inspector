/**
 * <FogVolume> draws Godot's editor gizmo for every node, faint while unselected: the 12 edges of its
 * box, for every shape but WORLD (`fog_volume_gizmo_plugin.cpp:92-125`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';
import { FogVolume } from './Component';
import { parseFogVolume } from './parser';

const GIZMO_COLOR = godotColorToLinear({ r: 0.5, g: 0.7, b: 1 });

function fogVolume(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Fog',
    type: 'FogVolume',
    children: [],
    properties: parseFogVolume(heading('FogVolume', { name: 'Fog' }), props),
  } as TscnNode;
}

async function render(selectedPath: string | null, props: Record<string, string> = {}, showGizmos = true) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Fog" selectedPath={selectedPath} showGizmos={showGizmos}>
      <FogVolume node={fogVolume(props)}>
        <group name="Child" />
      </FogVolume>
    </GizmoScene>
  );
}

/** Each gizmo line object's vertices and colour. Adding 0 turns a negative zero, which `-size / 2` leaves, into 0. */
async function gizmoLines(props: Record<string, string>) {
  const renderer = await render('Fog', props);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array, (value) => value + 0),
      color: (object.material as THREE.LineBasicMaterial).color,
    };
  });
}

describe('<FogVolume> gizmo state', () => {
  it('draws the box in full colour when the node is selected', async () => {
    expect(lineOpacities(await render('Fog'))).toEqual([1]);
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the box faintly, at 0.3, when %s', async (_label, selectedPath) => {
    expect(lineOpacities(await render(selectedPath))).toEqual([0.3]);
  });

  it('draws no box with the Gizmos toggle off, selected', async () => {
    const renderer = await render('Fog', {}, false);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Fog']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Fog' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<FogVolume> gizmo', () => {
  it('draws the 12 edges of the default box, from -1 to 1, in the order of AABB::get_edge', async () => {
    const [box] = await gizmoLines({});
    expect(box!.positions).toHaveLength(72);
    expect(box!.positions.slice(0, 12)).toEqual([1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1]);
  });

  it('draws the edges of an authored size, centred on the node', async () => {
    const [box] = await gizmoLines({ size: 'Vector3(4, 1, 2)' });
    expect(box!.positions.slice(0, 6)).toEqual([2, -0.5, -1, -2, -0.5, -1]);
  });

  it('draws the box in the fog colour (0.5, 0.7, 1)', async () => {
    const [box] = await gizmoLines({});
    expect(box!.color.toArray()).toEqual(GIZMO_COLOR.toArray());
  });

  it.each([
    ['ELLIPSOID', 0],
    ['CONE', 1],
    ['CYLINDER', 2],
    ['BOX', 3],
    ['a value outside the enum, which Godot stores', 7],
  ])('draws the box of the shape %s, whatever the shape', async (_name, shape) => {
    expect(await gizmoLines({ shape: String(shape) })).toHaveLength(1);
  });

  it('draws nothing for the WORLD shape, which ignores the size', async () => {
    expect(await gizmoLines({ shape: '4' })).toEqual([]);
  });

  it('draws the 12 edges at the origin for a size of 0 (edge case)', async () => {
    const [box] = await gizmoLines({ size: 'Vector3(0, 0, 0)' });
    expect(box!.positions).toEqual(new Array(72).fill(0));
  });

  it('draws a size below 0 as 0, as set_size raises it (edge case)', async () => {
    const [box] = await gizmoLines({ size: 'Vector3(-2, 2, 2)' });
    expect(box!.positions.slice(0, 6)).toEqual([0, -1, -1, 0, -1, -1]);
  });
});
