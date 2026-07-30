/**
 * <VehicleWheel3D> draws a selection-gated wheel gizmo (ADR-0018): visible only
 * while this node is the selected node; children are positioned either way.
 *
 * Godot's own gizmo (editor/scene/3d/gizmos/physics/vehicle_body_3d_gizmo_plugin.cpp)
 * is always-on for every wheel; gating it on selection is the same deliberate
 * divergence ADR-0018 records for Marker3D and Path3D.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { VehicleWheel3D } from './Component';
import { parseVehicleWheel3D } from './parser';
import { NodePathProvider } from '../../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../../r3f/contexts/SelectionContext';

function wheelNode(props: Record<string, string> = {}): TscnNode {
  return {
    name: 'Wheel1',
    type: 'VehicleWheel3D',
    children: [],
    properties: parseVehicleWheel3D(
      { type: 'node', attributes: { type: 'VehicleWheel3D', name: 'Wheel1' } },
      props
    ),
  } as TscnNode;
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

async function renderWheel(selectedPath: string | null, props: Record<string, string> = {}) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="Wheel1">
        <VehicleWheel3D node={wheelNode(props)} />
      </NodePathProvider>
    </SelectionProvider>
  );
}

/** The gizmo's flat [x,y,z,…] vertex buffer. */
async function gizmoPositions(props: Record<string, string>): Promise<Float32Array> {
  const renderer = await renderWheel('Wheel1', props);
  const lines = renderer.scene.findAllByType('LineSegments');
  expect(lines).toHaveLength(1);
  const geometry = (lines[0]!.instance as THREE.LineSegments).geometry;
  return geometry.getAttribute('position').array as Float32Array;
}

/** Whether the flat vertex buffer contains this exact point. */
function containsPoint(positions: Float32Array, [x, y, z]: [number, number, number]): boolean {
  for (let i = 0; i < positions.length; i += 3) {
    if (
      Math.abs(positions[i]! - x) < 1e-6 &&
      Math.abs(positions[i + 1]! - y) < 1e-6 &&
      Math.abs(positions[i + 2]! - z) < 1e-6
    ) {
      return true;
    }
  }
  return false;
}

describe('<VehicleWheel3D> gizmo gate', () => {
  it('hides the wheel gizmo when not selected', async () => {
    const renderer = await renderWheel(null);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws the wheel gizmo when selected', async () => {
    const renderer = await renderWheel('Wheel1');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('hides the gizmo when a different node is selected', async () => {
    const renderer = await renderWheel('Other');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws no mesh of its own — the visible wheel is a child MeshInstance3D', async () => {
    const renderer = await renderWheel('Wheel1');
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});

describe('<VehicleWheel3D> gizmo geometry', () => {
  it('scales the radius circle with wheel_radius', async () => {
    // The circle lies in the YZ plane, so its extent in Z is the wheel radius.
    const quarter = await gizmoPositions({ wheel_radius: '0.25' });
    const half = await gizmoPositions({ wheel_radius: '0.5' });

    const maxZ = (a: Float32Array) => {
      let m = -Infinity;
      for (let i = 2; i < a.length; i += 3) m = Math.max(m, a[i]!);
      return m;
    };
    // Forward arrow reaches 2r in +Z, so the buffer's extreme Z is 2 × radius.
    expect(maxZ(quarter)).toBeCloseTo(0.5, 5);
    expect(maxZ(half)).toBeCloseTo(1.0, 5);
  });

  it('draws the suspension travel line up to wheel_rest_length', async () => {
    const positions = await gizmoPositions({ wheel_radius: '0.25', wheel_rest_length: '0.3' });
    // The travel line runs from the origin to (0, rest_length, 0). maxY would
    // not prove this: the radius circle reaches y = r on its own.
    expect(containsPoint(positions, [0, 0.3, 0])).toBe(true);
    expect(containsPoint(positions, [0, 0, 0])).toBe(true);
  });

  it("uses Godot's defaults when the wheel authors no geometry", async () => {
    const positions = await gizmoPositions({});
    let maxZ = -Infinity;
    for (let i = 2; i < positions.length; i += 3) maxZ = Math.max(maxZ, positions[i]!);

    expect(maxZ).toBeCloseTo(1.0, 5); // 2 × default radius 0.5
    expect(containsPoint(positions, [0, 0.15, 0])).toBe(true); // default rest length
  });

  it('emits the vertex count Godot’s gizmo loop produces', async () => {
    // 37 loop iterations (i = 0..360 step 10, the last overlapping the first),
    // each pushing 1 circle segment + 4 coil segments = 2 + 8 points, then
    // 2 travel + 4 axle + 6 arrow points appended once. 37 × 10 + 12 = 382.
    const positions = await gizmoPositions({ wheel_radius: '0.25' });
    expect(positions.length / 3).toBe(382);
  });
});
