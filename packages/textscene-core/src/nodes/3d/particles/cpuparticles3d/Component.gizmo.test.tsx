/**
 * <CPUParticles3D> draws Godot's editor gizmos only while it is selected (ADR-0018): the
 * `visibility_aabb` box with the three unit axes from its centre
 * (`cpu_particles_3d_gizmo_plugin.cpp:62-98`), and its own emission shape
 * (`particles_3d_emission_shape_gizmo_plugin.cpp:218-337`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { NodePathProvider } from '../../../../r3f/contexts/NodePathContext';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import { SelectSeeder } from '../../../../r3f/testing/SelectSeeder';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import './index.r3f';
import { parseCPUParticles3D } from './parser';

/** The registered component, which the registry mounts inside the node's place in the scene cull. */
const CPUParticles3D = nodeComponentRegistry.get('CPUParticles3D')!;

const BOX_COLOR = godotColorToLinear({ r: 0.8, g: 0.7, b: 0.4 });
const EMISSION_COLOR = godotColorToLinear({ r: 0.5, g: 0.7, b: 1 });

function emitter(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Sparks',
    type: 'CPUParticles3D',
    children: [],
    properties: parseCPUParticles3D(heading('CPUParticles3D', { name: 'Sparks' }), props),
  } as TscnNode;
}

async function render(selectedPath: string | null, props: Record<string, string> = {}) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="Sparks">
        <CPUParticles3D node={emitter(props)}>
          <group name="Child" />
        </CPUParticles3D>
      </NodePathProvider>
    </SelectionProvider>
  );
}

/** Each gizmo line object's vertices and colour, in draw order. */
async function gizmoLines(props: Record<string, string>) {
  const renderer = await render('Sparks', props);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array),
      color: (object.material as THREE.LineBasicMaterial).color,
    };
  });
}

describe('<CPUParticles3D> gizmo gate', () => {
  it.each([
    ['the node is selected', 'Sparks', 2],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the box and its axes only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Sparks']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Sparks' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<CPUParticles3D> visibility box', () => {
  it('draws the 12 edges of an authored box in the particles gizmo colour', async () => {
    const [box] = await gizmoLines({ visibility_aabb: 'AABB(-2, -2, -2, 4, 4, 4)' });
    expect(box!.positions).toHaveLength(72);
    expect(box!.positions.slice(0, 6)).toEqual([2, -2, -2, -2, -2, -2]);
    expect(box!.color.toArray()).toEqual(BOX_COLOR.toArray());
  });

  it('draws a unit axis along +X, +Y and +Z from the centre of the box', async () => {
    const [, axes] = await gizmoLines({ visibility_aabb: 'AABB(-1, 0, -1, 2, 3, 2)' });
    expect(axes!.positions).toEqual([0, 1.5, 0, 1, 1.5, 0, 0, 1.5, 0, 0, 2.5, 0, 0, 1.5, 0, 0, 1.5, 1]);
    expect(axes!.color.toArray()).toEqual(BOX_COLOR.toArray());
  });

  it('draws zero-length edges and the unit axes from the origin for an absent box (edge case)', async () => {
    const [box, axes] = await gizmoLines({});
    expect(box!.positions).toEqual(new Array(72).fill(0));
    expect(axes!.positions).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('draws the same for an authored AABB(), which the instance clears (edge case)', async () => {
    expect(await gizmoLines({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)' })).toEqual(await gizmoLines({}));
  });
});

describe('<CPUParticles3D> solid box', () => {
  async function solidBoxes(selectedPath: string | null, props: Record<string, string> = {}) {
    const renderer = await render(selectedPath, props);
    return renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
  }

  it('fills the authored box faintly in the particles colour while selected', async () => {
    const [solid] = await solidBoxes('Sparks', { visibility_aabb: 'AABB(-1, 0, -1, 2, 3, 2)' });
    const material = solid!.material as THREE.MeshBasicMaterial;
    expect(new THREE.Box3().setFromObject(solid!).getSize(new THREE.Vector3()).toArray()).toEqual([2, 3, 2]);
    expect(material.color.toArray()).toEqual(BOX_COLOR.toArray());
    expect(material.opacity).toBe(0.016);
  });

  it('draws no fill unselected', async () => {
    expect(await solidBoxes(null, { visibility_aabb: 'AABB(-1, 0, -1, 2, 3, 2)' })).toHaveLength(0);
  });
});

describe('<CPUParticles3D> emission shape', () => {
  it('draws nothing more for the Point shape', async () => {
    expect(await gizmoLines({})).toHaveLength(2);
  });

  it('draws the ring of the fixture, axis Y, in the emission colour', async () => {
    const lines = await gizmoLines({
      emission_shape: '6',
      emission_ring_axis: 'Vector3(0, 1, 0)',
      emission_ring_height: '2.0',
      emission_ring_radius: '1.5',
      emission_ring_inner_radius: '0.5',
      emission_ring_cone_angle: '45.0',
    });
    expect(lines).toHaveLength(3);
    expect(lines[2]!.positions).toHaveLength(988 * 3);
    expect(lines[2]!.positions.slice(6, 9)).toEqual([0, -1, 1.5]);
    expect(lines[2]!.color.toArray()).toEqual(EMISSION_COLOR.toArray());
  });

  it('draws the box of emission_box_extents', async () => {
    const lines = await gizmoLines({ emission_shape: '3', emission_box_extents: 'Vector3(2, 0.5, 1)' });
    expect(lines[2]!.positions.slice(0, 6)).toEqual([2, -0.5, -1, -2, -0.5, -1]);
  });

  it('draws the sphere of emission_sphere_radius, at the centre of the node with no offset', async () => {
    const lines = await gizmoLines({ emission_shape: '1', emission_sphere_radius: '0.5' });
    expect(lines[2]!.positions.slice(0, 3)).toEqual([0, 0, 0.5]);
  });
});
