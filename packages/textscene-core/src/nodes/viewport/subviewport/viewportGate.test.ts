/**
 * The update mode a SubViewport renders by, and the viewport it sits in, read from the live tree.
 * A SubViewportContainer parent replaces the authored mode (`subviewport_container.cpp:116-128`).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { viewportGateAt } from './viewportGate';
import '../../../r3f/nodes/index';

const { DISABLED, ONCE, WHEN_VISIBLE, ALWAYS } = SubViewportUpdateMode;

function treeOf(source: string) {
  const scene = new TscnParser().parse(`[gd_scene format=3]\n\n${source}`);
  return liveTreeOf(scene.nodes, contextOver(scene, {}));
}

describe('viewportGateAt: update mode', () => {
  it('keeps the authored mode under a plain parent', () => {
    const tree = treeOf(`[node name="Root" type="Node"]

[node name="View" type="SubViewport" parent="."]
`);
    expect(viewportGateAt(tree, 'Root/View', ONCE).updateMode).toBe(ONCE);
  });

  it('forces ALWAYS under a visible SubViewportContainer, whatever the authored mode', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="View" type="SubViewport" parent="Booth"]
`);
    expect(viewportGateAt(tree, 'Root/Booth/View', DISABLED).updateMode).toBe(ALWAYS);
  });

  it('forces DISABLED under a SubViewportContainer with visible off', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]
visible = false

[node name="View" type="SubViewport" parent="Booth"]
`);
    expect(viewportGateAt(tree, 'Root/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('forces DISABLED when an ancestor Control is hidden', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Panel" type="Panel" parent="."]
visible = false

[node name="Booth" type="SubViewportContainer" parent="Panel"]

[node name="View" type="SubViewport" parent="Panel/Booth"]
`);
    expect(viewportGateAt(tree, 'Root/Panel/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('forces DISABLED under a container on a hidden CanvasLayer', () => {
    const tree = treeOf(`[node name="Root" type="Node"]

[node name="Layer" type="CanvasLayer" parent="."]
visible = false

[node name="Booth" type="SubViewportContainer" parent="Layer"]

[node name="View" type="SubViewport" parent="Layer/Booth"]
`);
    expect(viewportGateAt(tree, 'Root/Layer/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('stops the visibility climb at a node that is no CanvasItem', () => {
    const tree = treeOf(`[node name="Root" type="Control"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Booth" type="SubViewportContainer" parent="Plain"]

[node name="View" type="SubViewport" parent="Plain/Booth"]
`);
    expect(viewportGateAt(tree, 'Root/Plain/Booth/View', DISABLED).updateMode).toBe(ALWAYS);
  });

  it('keeps the authored mode of a viewport nested in a viewport under a container', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="Outer" type="SubViewport" parent="Booth"]

[node name="Inner" type="SubViewport" parent="Booth/Outer"]
`);
    expect(viewportGateAt(tree, 'Root/Booth/Outer/Inner', WHEN_VISIBLE).updateMode).toBe(WHEN_VISIBLE);
  });
});

describe('viewportGateAt: enclosing viewport', () => {
  const tree = treeOf(`[node name="Root" type="Node"]

[node name="Outer" type="SubViewport" parent="."]

[node name="Group" type="Node" parent="Outer"]

[node name="Inner" type="SubViewport" parent="Outer/Group"]
`);

  it('is null at the root viewport', () => {
    expect(viewportGateAt(tree, 'Root/Outer', ALWAYS).enclosingPath).toBeNull();
  });

  it('names the nearest SubViewport above, past plain nodes', () => {
    expect(viewportGateAt(tree, 'Root/Outer/Group/Inner', ALWAYS).enclosingPath).toBe('Root/Outer');
  });
});
