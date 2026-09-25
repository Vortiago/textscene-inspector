/**
 * A sub-viewport is a canvas boundary, not a world boundary (ADR-0033), as measured
 * in Godot: `Viewport::find_world_3d` falls through to the parent viewport unless
 * `own_world_3d` is set, while `find_world_2d` never does. Godot's render shows the
 * sphere and not the ColorRect.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { parseSubViewport } from './parser';
import { SubViewport, allocatableExtent } from './Component';
import { MAX_TEXTURE_EXTENT } from '../../../godot/index.js';
import { SceneStack } from '../../../r3f/testing/SceneStack';

import '../../../r3f/nodes/index';

const baseNode: TscnNode = {
  name: 'MySubViewport',
  type: 'SubViewport',
  children: [],
  properties: parseSubViewport(
    { type: 'node', attributes: { type: 'SubViewport', name: 'MySubViewport' } },
    {}
  ),
};

/** A scene with content both outside and inside the sub-viewport. */
const scene = (subViewportProps = '') => `[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]

[node name="OutsideBox" type="MeshInstance3D" parent="."]
mesh = SubResource("1")

[node name="Viewport" type="SubViewport" parent="."]
${subViewportProps}

[node name="InsideSphere" type="MeshInstance3D" parent="Viewport"]
mesh = SubResource("1")

[node name="InsideRect" type="ColorRect" parent="Viewport"]
`;

async function render(source: string, workspace?: '2d' | '3d') {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  return ReactThreeTestRenderer.create(
    <SceneStack workspace={workspace} loader={fake.loader} scene={parsed}>
      <NodeDispatcher nodes={parsed.nodes} />
    </SceneStack>
  );
}

describe('<SubViewport> as a world boundary', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SubViewport node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('shares the parent World3D by default: 3D descendants DO draw in the 3D view', async () => {
    const r = await render(scene());
    expect(r.scene.findAllByProps({ name: 'OutsideBox' }).length).toBeGreaterThan(0);
    expect(r.scene.findAllByProps({ name: 'InsideSphere' }).length).toBeGreaterThan(0);
  });

  it('own_world_3d = true severs the shared world: 3D descendants vanish', async () => {
    const r = await render(scene('own_world_3d = true'));
    expect(r.scene.findAllByProps({ name: 'OutsideBox' }).length).toBeGreaterThan(0);
    expect(r.scene.findAllByProps({ name: 'InsideSphere' })).toHaveLength(0);
  });

  it('disable_3d does NOT hide 3D descendants from the parent view (measured)', async () => {
    const r = await render(scene('disable_3d = true'));
    expect(r.scene.findAllByProps({ name: 'InsideSphere' }).length).toBeGreaterThan(0);
  });

  it('always owns its World2D: descendants never reach the 2D world canvas', async () => {
    const r = await render(scene(), '2d');
    expect(r.scene.findAllByProps({ name: 'InsideRect' })).toHaveLength(0);
    expect(r.scene.findAllByProps({ name: 'InsideSphere' })).toHaveLength(0);
  });

  it('3D content inside a CONTAINED sub-viewport still reaches the 3D view', async () => {
    // SubViewportContainer is a Control in TWO_D_UI_TYPES, so `PlainNode` would
    // drop its whole subtree in the 3D workspace, the sub-viewport's 3D content
    // included. Godot draws that content (shared World3D), so the drop rule
    // subtracts viewport surfaces (ADR-0033).
    const r = await render(`[gd_scene format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="View" type="SubViewport" parent="Booth"]

[node name="Contained" type="MeshInstance3D" parent="Booth/View"]
mesh = SubResource("1")
`);
    expect(r.scene.findAllByProps({ name: 'Contained' }).length).toBeGreaterThan(0);
  });
});

describe('allocatableExtent', () => {
  it('rounds an in-range axis to whole pixels', () => {
    expect(allocatableExtent(511.6)).toBe(512);
  });

  it("floors an axis at Godot's 2 pixels", () => {
    expect(allocatableExtent(1)).toBe(2);
    expect(allocatableExtent(-40)).toBe(2);
  });

  it('caps an axis at the shared texture ceiling', () => {
    expect(allocatableExtent(MAX_TEXTURE_EXTENT)).toBe(MAX_TEXTURE_EXTENT);
    expect(allocatableExtent(2000000000)).toBe(MAX_TEXTURE_EXTENT);
  });

  it('allocates the floor for an axis that is not a finite number', () => {
    expect(allocatableExtent(Number.NaN)).toBe(2);
    expect(allocatableExtent(Number.POSITIVE_INFINITY)).toBe(2);
  });
});
