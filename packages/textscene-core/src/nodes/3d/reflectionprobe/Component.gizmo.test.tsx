/**
 * <ReflectionProbe> draws Godot's editor gizmo only while it is selected and the Gizmos toggle is on
 * (`reflection_probe_gizmo_plugin.cpp:152`): the blend box, the lines to the outer box and the origin
 * cross (`reflection_probe_gizmo_plugin.cpp:149-212`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { GizmoScene } from '../../../r3f/testing/GizmoScene';
import { ReflectionProbe } from './Component';
import { parseReflectionProbe } from './parser';

const GIZMO_COLOR = godotColorToLinear({ r: 0.6, g: 1, b: 0.5 });

function probe(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Probe',
    type: 'ReflectionProbe',
    children: [],
    properties: parseReflectionProbe(heading('ReflectionProbe', { name: 'Probe' }), props),
  } as TscnNode;
}

async function render(selectedPath: string | null, props: Record<string, string> = {}, showGizmos = true) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Probe" selectedPath={selectedPath} showGizmos={showGizmos}>
      <ReflectionProbe node={probe(props)}>
        <group name="Child" />
      </ReflectionProbe>
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

describe('<ReflectionProbe> gizmo gate', () => {
  it.each([
    ['the node is selected', 'Probe', 2],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the blend box and the internal lines only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('draws nothing with the Gizmos toggle off, selected', async () => {
    const renderer = await render('Probe', {}, false);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Probe']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Probe' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<ReflectionProbe> gizmo', () => {
  it('draws the blend box of the default probe, from -9 to 9, at full opacity', async () => {
    const [blend] = await gizmoLines({});
    expect(blend!.positions).toHaveLength(72);
    expect(blend!.positions.slice(0, 6)).toEqual([9, -9, -9, -9, -9, -9]);
    expect(blend!.opacity).toBe(1);
  });

  it('draws the lines to the outer box at the opacity 0.5', async () => {
    const [, internal] = await gizmoLines({});
    expect(internal!.positions).toHaveLength(48);
    expect(internal!.positions.slice(0, 6)).toEqual([-9, -9, -9, -10, -10, -10]);
    expect(internal!.opacity).toBe(0.5);
  });

  it('draws both in the probe colour (0.6, 1, 0.5)', async () => {
    const lines = await gizmoLines({});
    expect(lines.map((line) => line.color.toArray())).toEqual([GIZMO_COLOR.toArray(), GIZMO_COLOR.toArray()]);
  });

  it('draws nothing for a blend distance of 0 and no origin offset', async () => {
    expect(await gizmoLines({ blend_distance: '0.0' })).toEqual([]);
  });

  it('draws the origin cross alone for a blend distance of 0', async () => {
    const [cross] = await gizmoLines({ blend_distance: '0.0', origin_offset: 'Vector3(3, 0, 0)' });
    expect(cross!.positions.slice(0, 6)).toEqual([2.75, 0, 0, 3.25, 0, 0]);
  });

  it('draws the origin cross where the setter clamped an offset that left the box (edge case)', async () => {
    const [cross] = await gizmoLines({
      size: 'Vector3(20, 20, 20)',
      blend_distance: '0.0',
      origin_offset: 'Vector3(15, 0, 0)',
    });
    expect(cross!.positions[0]).toBeCloseTo(9.74, 5);
    expect(cross!.positions[3]).toBeCloseTo(10.24, 5);
  });

  it('draws the collapsed blend box of a probe that blends further than half its size (edge case)', async () => {
    const [blend] = await gizmoLines({ blend_distance: '12.0' });
    expect(blend!.positions).toEqual(new Array(72).fill(0));
  });
});
