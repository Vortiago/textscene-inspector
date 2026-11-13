/** One reader of the CanvasItem fields gives a Node2D and a Control the same answer for the same file. */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { canvasItemFieldsOf } from './canvasItemFields';
import '../nodes/index';

const CANVAS_ITEM_LINES = `modulate = Color(0.2, 0.4, 0.9, 0.5)
z_index = 3
z_as_relative = false
top_level = true
use_parent_material = true
texture_filter = 2
texture_repeat = 3
material = SubResource("Mat")
visible = false
clip_children = 2
y_sort_enabled = true
show_behind_parent = true`;

function parsedRoot(type: string, lines: string): TscnNode {
  const text = `[gd_scene format=3]

[sub_resource type="CanvasItemMaterial" id="Mat"]

[node name="Item" type="${type}"]
${lines}
`;
  return new TscnParser().parse(text).nodes[0]!;
}

describe('canvasItemFieldsOf', () => {
  it('reads a Control the same as a Node2D, except its transform', () => {
    const node2D = canvasItemFieldsOf(
      parsedRoot('Node2D', `position = Vector2(30, 40)\n${CANVAS_ITEM_LINES}`)
    );
    const control = canvasItemFieldsOf(parsedRoot('Control', `offset_left = 30.0\n${CANVAS_ITEM_LINES}`));
    expect(control).toEqual({ ...node2D, local: null });
    expect(node2D).toMatchObject({
      modulate: { r: 0.2, g: 0.4, b: 0.9, a: 0.5 },
      zIndex: 3,
      zAsRelative: false,
      isTopLevel: true,
      usesParentMaterial: true,
      textureFilter: 2,
      textureRepeat: 3,
      materialRef: 'SubResource("Mat")',
      isVisible: false,
      clipChildren: 2,
      ySortEnabled: true,
      showsBehindParent: true,
    });
    expect(node2D!.local).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 30, ty: 40 });
  });

  it("gives Godot's defaults for an item that sets nothing", () => {
    expect(canvasItemFieldsOf(parsedRoot('Control', ''))).toEqual({
      local: null,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      zIndex: 0,
      zAsRelative: true,
      materialRef: undefined,
      usesParentMaterial: false,
      textureFilter: 0,
      textureRepeat: 0,
      isTopLevel: false,
      isVisible: true,
      clipChildren: 0,
      ySortEnabled: false,
      showsBehindParent: false,
    });
  });

  it('answers null for a node that is no CanvasItem', () => {
    expect(canvasItemFieldsOf(parsedRoot('Node', ''))).toBeNull();
    expect(canvasItemFieldsOf(parsedRoot('CanvasLayer', ''))).toBeNull();
  });
});
