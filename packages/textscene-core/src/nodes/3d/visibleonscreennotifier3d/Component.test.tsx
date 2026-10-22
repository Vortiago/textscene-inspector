/**
 * <VisibleOnScreenNotifier3D> and <VisibleOnScreenEnabler3D> draw Godot's editor gizmo only while
 * selected (ADR-0018): the 12 edges of `aabb`, three unit axes from its centre and a faint fill
 * (`visible_on_screen_notifier_3d_gizmo_plugin.cpp:149-194`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { SelectSeeder } from '../../../r3f/testing/SelectSeeder';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import './index.r3f';
import '../visibleonscreenenabler3d/index.r3f';
import { parseVisibleOnScreenNotifier3D } from './parser';

const GIZMO_COLOR = godotColorToLinear({ r: 0.8, g: 0.5, b: 0.7 });

function notifier(type: string, props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Notifier',
    type,
    children: [],
    properties: parseVisibleOnScreenNotifier3D(heading(type, { name: 'Notifier' }), props),
  } as TscnNode;
}

async function render(
  selectedPath: string | null,
  props: Record<string, string> = {},
  type = 'VisibleOnScreenNotifier3D'
) {
  const Component = nodeComponentRegistry.get(type)!;
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="Notifier">
        <Component node={notifier(type, props)}>
          <group name="Child" />
        </Component>
      </NodePathProvider>
    </SelectionProvider>
  );
}

/** Each gizmo line object's vertices and colour, in draw order. */
async function gizmoLines(props: Record<string, string>, type?: string) {
  const renderer = await render('Notifier', props, type);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array),
      color: (object.material as THREE.LineBasicMaterial).color,
    };
  });
}

describe.each(['VisibleOnScreenNotifier3D', 'VisibleOnScreenEnabler3D'])('<%s> gizmo gate', (type) => {
  it.each([
    ['the node is selected', 'Notifier', 2],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the edges and the axes only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath, {}, type);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Notifier']) {
      const renderer = await render(selected, {}, type);
      const group = renderer.scene.findByProps({ name: 'Notifier' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<VisibleOnScreenNotifier3D> gizmo', () => {
  it('draws the 12 edges of the default box from -1 to 1, in the order of AABB::get_edge', async () => {
    const [box] = await gizmoLines({});
    expect(box!.positions).toHaveLength(72);
    expect(box!.positions.slice(0, 12)).toEqual([1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1]);
  });

  it('draws the edges of an authored box', async () => {
    const [box] = await gizmoLines({ aabb: 'AABB(0, 0, 0, 4, 1, 2)' });
    expect(box!.positions.slice(0, 12)).toEqual([4, 0, 0, 0, 0, 0, 4, 0, 2, 4, 0, 0]);
  });

  it('draws three unit axes from the centre of the box', async () => {
    const [, axes] = await gizmoLines({ aabb: 'AABB(0, 0, 0, 4, 1, 2)' });
    expect(axes!.positions).toEqual([2, 0.5, 1, 3, 0.5, 1, 2, 0.5, 1, 2, 1.5, 1, 2, 0.5, 1, 2, 0.5, 2]);
  });

  it('draws the edges and the axes in the notifier colour (0.8, 0.5, 0.7)', async () => {
    const lines = await gizmoLines({});
    expect(lines.map((line) => line.color.toArray())).toEqual([GIZMO_COLOR.toArray(), GIZMO_COLOR.toArray()]);
  });

  it('fills the box at the opacity 0.1 of the solid material', async () => {
    const renderer = await render('Notifier', { aabb: 'AABB(0, 0, 0, 4, 1, 2)' });
    const fill = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(fill);
    expect((fill.material as THREE.MeshBasicMaterial).opacity).toBe(0.1);
    expect([bounds.min.toArray(), bounds.max.toArray()]).toEqual([
      [0, 0, 0],
      [4, 1, 2],
    ]);
  });

  it('draws the 12 edges at the origin for AABB() (edge case)', async () => {
    const [box] = await gizmoLines({ aabb: 'AABB(0, 0, 0, 0, 0, 0)' });
    expect(box!.positions).toEqual(new Array(72).fill(0));
  });
});

describe('<VisibleOnScreenEnabler3D> gizmo', () => {
  it('draws the same gizmo as its base class', async () => {
    const props = { aabb: 'AABB(0, 0, 0, 4, 1, 2)' };
    expect(await gizmoLines(props, 'VisibleOnScreenEnabler3D')).toEqual(await gizmoLines(props));
  });
});
