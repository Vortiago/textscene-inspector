/**
 * The update mode a SubViewport renders by, and the viewport it sits in, read from the live tree.
 * A SubViewportContainer parent replaces the authored mode (`subviewport_container.cpp:116-128`).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { projectTreeSettings, type ProjectSettings } from '../../../parser/projectSettingsParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { resolveGate, viewportGateAt } from './viewportGate';
import '../../../r3f/nodes/index';

const { DISABLED, ONCE, WHEN_VISIBLE, ALWAYS } = SubViewportUpdateMode;

/** The live tree of `source` under `settings`, which default to no project: the root embeds its windows. */
function treeOf(source: string, settings: ProjectSettings | null = null) {
  const scene = new TscnParser().parse(`[gd_scene format=3]\n\n${source}`);
  return liveTreeOf(scene.nodes, { ...contextOver(scene, {}), project: projectTreeSettings(settings) });
}

/** The gate of the viewport at `path` with no animated `visible` over it. */
function resolved(tree: ReturnType<typeof treeOf>, path: string, authoredMode: number) {
  return resolveGate(viewportGateAt(tree, path, authoredMode), new Map());
}

describe('viewportGateAt: update mode', () => {
  it('keeps the authored mode under a plain parent', () => {
    const tree = treeOf(`[node name="Root" type="Node"]

[node name="View" type="SubViewport" parent="."]
`);
    expect(resolved(tree, 'Root/View', ONCE).updateMode).toBe(ONCE);
  });

  it('forces ALWAYS under a visible SubViewportContainer, whatever the authored mode', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="View" type="SubViewport" parent="Booth"]
`);
    expect(resolved(tree, 'Root/Booth/View', DISABLED).updateMode).toBe(ALWAYS);
  });

  it('forces DISABLED under a SubViewportContainer with visible off', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]
visible = false

[node name="View" type="SubViewport" parent="Booth"]
`);
    expect(resolved(tree, 'Root/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('forces DISABLED when an ancestor Control is hidden', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Panel" type="Panel" parent="."]
visible = false

[node name="Booth" type="SubViewportContainer" parent="Panel"]

[node name="View" type="SubViewport" parent="Panel/Booth"]
`);
    expect(resolved(tree, 'Root/Panel/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('forces DISABLED under a container on a hidden CanvasLayer', () => {
    const tree = treeOf(`[node name="Root" type="Node"]

[node name="Layer" type="CanvasLayer" parent="."]
visible = false

[node name="Booth" type="SubViewportContainer" parent="Layer"]

[node name="View" type="SubViewport" parent="Layer/Booth"]
`);
    expect(resolved(tree, 'Root/Layer/Booth/View', ALWAYS).updateMode).toBe(DISABLED);
  });

  it('stops the visibility climb at a node that is no CanvasItem', () => {
    const tree = treeOf(`[node name="Root" type="Control"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Booth" type="SubViewportContainer" parent="Plain"]

[node name="View" type="SubViewport" parent="Plain/Booth"]
`);
    expect(resolved(tree, 'Root/Plain/Booth/View', DISABLED).updateMode).toBe(ALWAYS);
  });

  it('keeps the authored mode of a viewport nested in a viewport under a container', () => {
    const tree = treeOf(`[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="Outer" type="SubViewport" parent="Booth"]

[node name="Inner" type="SubViewport" parent="Booth/Outer"]
`);
    expect(resolved(tree, 'Root/Booth/Outer/Inner', WHEN_VISIBLE).updateMode).toBe(WHEN_VISIBLE);
  });
});

describe('viewportGateAt: enclosing viewport', () => {
  const tree = treeOf(`[node name="Root" type="Node"]

[node name="Outer" type="SubViewport" parent="."]

[node name="Group" type="Node" parent="Outer"]

[node name="Inner" type="SubViewport" parent="Outer/Group"]
`);

  it('is null at the root viewport', () => {
    expect(resolved(tree, 'Root/Outer', ALWAYS).enclosingPath).toBeNull();
  });

  it('names the nearest SubViewport above, past plain nodes', () => {
    expect(resolved(tree, 'Root/Outer/Group/Inner', ALWAYS).enclosingPath).toBe('Root/Outer');
  });
});

/** A window's viewport follows its embedder's passes (`viewport.cpp:339`), found by `Window::get_embedder`. */
describe('viewportGateAt: a window follows its embedder', () => {
  const tree = treeOf(`[node name="Root" type="Control"]

[node name="Frozen" type="SubViewport" parent="."]
render_target_update_mode = 0

[node name="Win" type="Window" parent="Frozen"]

[node name="Embedding" type="SubViewport" parent="."]
gui_embed_subwindows = true

[node name="Group" type="Node" parent="Embedding"]

[node name="Plain" type="SubViewport" parent="Embedding/Group"]

[node name="Inner" type="Window" parent="Embedding/Group/Plain"]

[node name="Panel" type="Control" parent="Embedding/Group/Plain/Inner"]

[node name="View" type="SubViewport" parent="Embedding/Group/Plain/Inner/Panel"]
`);

  it('steps past a viewport that embeds no windows to the root (`window.cpp:1406-1418`)', () => {
    expect(resolved(tree, 'Root/Frozen/Win', ALWAYS).enclosingPath).toBeNull();
  });

  it('names the nearest viewport that embeds windows', () => {
    expect(resolved(tree, 'Root/Embedding/Group/Plain/Inner', ALWAYS).enclosingPath).toBe('Root/Embedding');
  });

  it('leaves a SubViewport inside a window under the window (`viewport.cpp:579`)', () => {
    expect(resolved(tree, 'Root/Embedding/Group/Plain/Inner/Panel/View', ALWAYS).enclosingPath).toBe(
      'Root/Embedding/Group/Plain/Inner'
    );
  });
});

/** A window below an embedding root embeds only when `force_native` (`window.cpp:1534-1537`). */
describe('viewportGateAt: a window above a window', () => {
  const WINDOWS = `[node name="Root" type="Control"]

[node name="Host" type="Window" parent="."]
gui_embed_subwindows = true

[node name="Inner" type="Window" parent="Host"]
`;

  it('leaves the window below to an embedding root, whatever the window above authors', () => {
    expect(resolved(treeOf(WINDOWS), 'Root/Host/Inner', ALWAYS).enclosingPath).toBeNull();
  });

  it('names the window above under a root that embeds none, where its authored value stands', () => {
    const tree = treeOf(WINDOWS, { 'display/window/subwindows/embed_subwindows': 'false' });
    expect(resolved(tree, 'Root/Host/Inner', ALWAYS).enclosingPath).toBe('Root/Host');
  });
});

describe('resolveGate: an animated visible', () => {
  const tree = treeOf(`[node name="Root" type="Control"]

[node name="Panel" type="Panel" parent="."]

[node name="Booth" type="SubViewportContainer" parent="Panel"]

[node name="View" type="SubViewport" parent="Panel/Booth"]
`);
  const gate = viewportGateAt(tree, 'Root/Panel/Booth/View', DISABLED);

  it('hides the viewport while the container is animated to hidden', () => {
    expect(resolveGate(gate, new Map([['Root/Panel/Booth', false]])).updateMode).toBe(DISABLED);
  });

  it('hides the viewport while an ancestor is animated to hidden', () => {
    expect(resolveGate(gate, new Map([['Root/Panel', false]])).updateMode).toBe(DISABLED);
  });

  it('shows the viewport while a hidden ancestor is animated to visible', () => {
    const hiddenTree = treeOf(`[node name="Root" type="Control"]

[node name="Panel" type="Panel" parent="."]
visible = false

[node name="Booth" type="SubViewportContainer" parent="Panel"]

[node name="View" type="SubViewport" parent="Panel/Booth"]
`);
    const hidden = viewportGateAt(hiddenTree, 'Root/Panel/Booth/View', ALWAYS);
    expect(resolveGate(hidden, new Map([['Root/Panel', true]])).updateMode).toBe(ALWAYS);
  });

  it('ignores an animated visible above a node that is no CanvasItem', () => {
    const plainTree = treeOf(`[node name="Root" type="Control"]

[node name="Plain" type="Node" parent="."]

[node name="Booth" type="SubViewportContainer" parent="Plain"]

[node name="View" type="SubViewport" parent="Plain/Booth"]
`);
    const plain = viewportGateAt(plainTree, 'Root/Plain/Booth/View', DISABLED);
    expect(resolveGate(plain, new Map([['Root', false]])).updateMode).toBe(ALWAYS);
  });
});
