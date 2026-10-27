/**
 * <VoxelGI> draws Godot's editor gizmo only while it is selected and the Gizmos toggle is on
 * (`voxel_gi_gizmo_plugin.cpp:99`): the edges of its box and the grid of its cells
 * (`voxel_gi_gizmo_plugin.cpp:96-164`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { GizmoScene } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import './index.r3f';
import { parseVoxelGI } from './parser';

/** The registered component, which the registry mounts under the node's place in the scene. */
const VoxelGI = nodeComponentRegistry.get('VoxelGI')!;

const GIZMO_COLOR = godotColorToLinear({ r: 0.5, g: 1, b: 0.6 });

function voxelGi(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Probe',
    type: 'VoxelGI',
    children: [],
    properties: parseVoxelGI(heading('VoxelGI', { name: 'Probe' }), props),
  } as TscnNode;
}

async function render(
  selectedPath: string | null,
  props: Record<string, string> = {},
  showGizmos = true,
  instantiated = false
) {
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Probe"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <VoxelGI node={voxelGi(props)}>
        <group name="Child" />
      </VoxelGI>
    </GizmoScene>
  );
}

/** Each gizmo line object's vertices, colour and opacity, in draw order. */
async function gizmoLines(props: Record<string, string>) {
  const renderer = await render('Probe', props);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    const material = object.material as THREE.LineBasicMaterial;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array),
      color: material.color,
      opacity: material.opacity,
    };
  });
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'Probe',
  drawnFor: 'selected-only',
  mount: ({ selectedPath, showGizmos, instantiated }) => render(selectedPath, {}, showGizmos, instantiated),
};
describeGizmoToggle('<VoxelGI>', GIZMO_CASE);
describeInstantiatedGizmo('<VoxelGI>', GIZMO_CASE);

describe('<VoxelGI> gizmo gate', () => {
  it.each([
    ['the node is selected', 'Probe', 2],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the box and the grid only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Probe']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Probe' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<VoxelGI> gizmo box', () => {
  it('draws the 12 edges of the default box, from -10 to 10, at full opacity', async () => {
    const [box] = await gizmoLines({});
    expect(box!.positions).toHaveLength(72);
    expect(box!.positions.slice(0, 6)).toEqual([10, -10, -10, -10, -10, -10]);
    expect(box!.opacity).toBe(1);
  });

  it('draws the edges of an authored size, centred on the node', async () => {
    const [box] = await gizmoLines({ size: 'Vector3(40, 10, 10)' });
    expect(box!.positions.slice(0, 6)).toEqual([20, -5, -5, -20, -5, -5]);
  });

  it('draws the box in the VoxelGI colour (0.5, 1, 0.6)', async () => {
    const [box, grid] = await gizmoLines({});
    expect([box!.color.toArray(), grid!.color.toArray()]).toEqual([
      GIZMO_COLOR.toArray(),
      GIZMO_COLOR.toArray(),
    ]);
  });

  it('draws a box of at least 1 on each side for a size the setter raises (edge case)', async () => {
    const [box] = await gizmoLines({ size: 'Vector3(0, 0, 0)' });
    expect(box!.positions.slice(0, 6)).toEqual([0.5, -0.5, -0.5, -0.5, -0.5, -0.5]);
  });
});

describe('<VoxelGI> gizmo grid', () => {
  it('draws 127 x 3 x 4 = 1524 segments for the default box and 128 subdivisions, at the opacity 0.02', async () => {
    const [, grid] = await gizmoLines({});
    expect(grid!.positions).toHaveLength(1524 * 6);
    expect(grid!.opacity).toBe(0.02);
  });

  it('steps by the longest side over the subdivisions: 20 / 128 = 0.15625', async () => {
    const [, grid] = await gizmoLines({});
    expect(grid!.positions.slice(0, 6)).toEqual([-9.84375, -10, -10, -9.84375, -10, 10]);
  });

  it('draws the cells of 64 subdivisions for subdiv 0 on a box of 40 x 10 x 10', async () => {
    const [, grid] = await gizmoLines({ size: 'Vector3(40, 10, 10)', subdiv: '0' });
    expect(grid!.positions).toHaveLength((63 + 16 + 16) * 4 * 6);
  });

  it.each([
    [0, 64],
    [1, 128],
    [2, 256],
    [3, 512],
  ])('draws (cells - 1) x 3 x 4 segments for subdiv %i, which is %i cells', async (subdiv, cells) => {
    const [, grid] = await gizmoLines({ subdiv: String(subdiv) });
    expect(grid!.positions).toHaveLength((cells - 1) * 3 * 4 * 6);
  });
});
