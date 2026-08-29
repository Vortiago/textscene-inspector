/**
 * VehicleWheel3D draws nothing at runtime — the visible wheel is its child
 * MeshInstance3D — so it renders as a transform group like the physics bodies
 * (ADR-0005, ADR-0008), plus a selection-gated gizmo covered in Component.test.tsx.
 *
 * The child-placement case here is a REGRESSION PIN, not a fix: an unregistered
 * type already reached parseNode (which parses `transform`) and GenericNodeFallback
 * already applied it, so wheels were positioned correctly before this slice.
 * Registering the type must not take that away.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import '../../../../r3f/nodes/index'; // side-effect: component registrations
import '../../../../parser/TscnParser'; // side-effect: parser registrations
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { TscnParser } from '../../../../parser/TscnParser';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import type { TscnNode } from '../../../../parser/types';
import type { Transform3D } from '../../../base/node3d/types';
import type { VehicleWheel3DProperties } from './types';

/** Wheel1 of car_base.tscn: identity basis at (0.573678, 0.115169, 1.10416). */
const wheelTransform: Transform3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 0.573678, y: 0.115169, z: 1.10416 },
};

function wheelNode(properties: Record<string, unknown> = {}): TscnNode {
  return {
    name: 'Wheel1',
    type: 'VehicleWheel3D',
    children: [{ name: 'WheelMesh', type: 'Node3D', children: [], properties: { name: 'WheelMesh' } }],
    properties: { name: 'Wheel1', transform: wheelTransform, ...properties },
  } as TscnNode;
}

async function render(node: TscnNode) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <NodeDispatcher nodes={[node]} />
    </SelectionProvider>
  );
}

describe('VehicleWheel3D registration', () => {
  it('is reported as drawing, so no "Not Implemented" badge', () => {
    expect(rendersOwnVisual('VehicleWheel3D')).toBe('draws');
  });

  it('honours visible = false, hiding itself and its wheel mesh', async () => {
    const renderer = await render(wheelNode({ visible: false }));
    expect(renderer.scene.findByProps({ name: 'Wheel1' }).instance.visible).toBe(false);
  });

  it('stays visible when visible is not authored', async () => {
    const renderer = await render(wheelNode());
    expect(renderer.scene.findByProps({ name: 'Wheel1' }).instance.visible).toBe(true);
  });

  it('is a real registration, not the generic placeholder fallback', async () => {
    const renderer = await render(wheelNode());
    expect(renderer.scene.findByProps({ name: 'Wheel1' }).instance.userData.isPlaceholder)
      .toBeUndefined();
  });

  it('parses its wheel properties through the real TscnParser', () => {
    const scene = new TscnParser().parse(
      [
        '[gd_scene format=3]',
        '',
        '[node name="Root" type="Node3D"]',
        '',
        '[node name="Vehicle" type="VehicleBody3D" parent="."]',
        '',
        '[node name="Wheel1" type="VehicleWheel3D" parent="Vehicle"]',
        'wheel_radius = 0.25',
        'use_as_steering = true',
      ].join('\n')
    );
    const wheel = scene.nodes[0]!.children[0]!.children[0]!;
    expect(wheel.type).toBe('VehicleWheel3D');
    const props = wheel.properties as VehicleWheel3DProperties;
    expect(props.wheel_radius).toBeCloseTo(0.25, 5);
    expect(props.use_as_steering).toBe(true);
  });

  it('surfaces its configuration to the inspector via a property formatter', () => {
    const registration = nodeRegistry.getRegistration('VehicleWheel3D');
    expect(registration?.propertyFormatter).toBeDefined();
    const titles = registration!
      .propertyFormatter!({ name: 'Wheel1', wheel_radius: 0.25 })
      .map((s) => s.title);
    expect(titles).toContain('Wheel');
  });

  it('still places its wheel mesh at the authored offset', async () => {
    const renderer = await render(wheelNode());
    const mesh = renderer.scene.findByProps({ name: 'WheelMesh' });
    const world = mesh.instance.getWorldPosition(new THREE.Vector3());
    expect(world.x).toBeCloseTo(0.573678, 5);
    expect(world.y).toBeCloseTo(0.115169, 5);
    expect(world.z).toBeCloseTo(1.10416, 5);
  });
});
