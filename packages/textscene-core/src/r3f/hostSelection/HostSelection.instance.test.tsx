import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { HostSelection } from './HostSelection';
import { useViewportSelection, type UseViewportSelectionResult } from '../hooks/useViewportSelection';
import { useSelection, type SelectionContextValue } from '../contexts/SelectionContext';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { TscnSceneContents } from '../TscnCanvas';
import { openScene } from '../../scene/openScene';
import type { NodeHandle } from '../../scene/nodeHandle';
import type { ResourceProvider } from '../../resources/ResourceProvider';

import '../nodes/index';

const PART_SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Part" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://part.tscn" id="1_part"]

[node name="Root" type="Node3D"]

[node name="Locked" parent="." instance=ExtResource("1_part")]

[node name="Open" parent="." instance=ExtResource("1_part")]

[editable path="Open"]
`;

const PART_FILE: ResourceProvider = {
  loadResource: async (path) => (path === 'res://part.tscn' ? PART_SCENE : null),
};

/** The picker and the selection of the mounted view, read from inside it. */
interface Reach {
  picker?: UseViewportSelectionResult;
  selection?: SelectionContextValue;
}

function Probe({ reach }: { reach: Reach }) {
  reach.picker = useViewportSelection();
  reach.selection = useSelection();
  return null;
}

/** The mesh drawn under the node at `path`, once the instance has loaded. */
async function meshUnder(reach: Reach, path: string): Promise<THREE.Mesh> {
  let mesh: THREE.Mesh | undefined;
  await vi.waitFor(() => {
    reach.selection?.nodeObjectMap.get(path)?.traverse((object) => {
      if (object instanceof THREE.Mesh) mesh ??= object;
    });
    expect(mesh).toBeDefined();
  });
  return mesh!;
}

async function pickedByClickUnder(path: string): Promise<(NodeHandle | null)[]> {
  const scene = openScene({ source: MAIN_SCENE, provider: PART_FILE });
  const onSelect = vi.fn();
  const reach: Reach = {};
  await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <HostSelection onSelect={onSelect}>
        <TscnSceneContents />
        <Probe reach={reach} />
      </HostSelection>
    </TscnSceneProvider>
  );
  const event = { button: 0, clientX: 10, clientY: 10, object: await meshUnder(reach, path) };
  await ReactThreeTestRenderer.act(async () => {
    reach.picker!.handlers.onPointerDown({ ...event, stopPropagation: () => {} } as never);
    reach.picker!.handlers.onPointerUp({ ...event, stopPropagation: () => {} } as never);
  });
  return onSelect.mock.calls.map(([node]) => node as NodeHandle | null);
}

// The owner walk of `node_3d_editor_plugin.cpp:807-815`.
describe('a click on a mesh of an instanced scene', () => {
  it('picks the instance, whose children the main scene does not own', async () => {
    const picks = await pickedByClickUnder('Root/Locked');

    expect(picks.map((node) => node?.path)).toEqual(['/root/Root/Locked']);
  });

  it('picks the mesh itself under an editable instance', async () => {
    const picks = await pickedByClickUnder('Root/Open');

    expect(picks.map((node) => node?.path)).toEqual(['/root/Root/Open/Mesh']);
  });
});
