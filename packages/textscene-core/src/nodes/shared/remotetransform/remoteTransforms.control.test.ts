/**
 * A relay below a Control composes the transform the Control walk solved for it, where the file
 * states no position alone: a pivot, or a Container that lays the Control out
 * (`control.cpp:719-737`, `canvas_item.cpp:176-186`).
 */
import { describe, it, expect } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { transform2DFromParts, type Transform2DColumns } from '../../../godot/math/transform2d.js';
import type { Node2DProperties } from '../../../nodes/base/node2d/types';
import { applyRemoteTransforms } from './remoteTransforms';

const relayBelow = (controlType: string, controlProperties: string) => `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Panel" type="${controlType}" parent="."]
${controlProperties}

[node name="Relay" type="RemoteTransform2D" parent="Panel"]
position = Vector2(40, 10)
remote_path = NodePath("../../Held")

[node name="Held" type="Node2D" parent="."]
`;

function heldPlacement(content: string, solved: ReadonlyMap<string, Transform2DColumns> | undefined) {
  const main = new TscnParser().parse(content);
  const tree = liveTreeOf(main.nodes, { ...contextOver(main, {}), controlTransforms: solved });
  return applyRemoteTransforms(tree).placed.get('Root/Held') as Node2DProperties | undefined;
}

describe('a relay below a Control the file does not place alone', () => {
  const SOLVED_PANEL = transform2DFromParts(0.5, { x: 1, y: 1 }, 0, { x: 100, y: 50 });
  const solved = new Map([['Root/Panel', SOLVED_PANEL]]);

  it('pushes the pose the solved Control gives, for a pivot', () => {
    const placed = heldPlacement(relayBelow('Control', 'pivot_offset = Vector2(50, 50)'), solved);
    // The relay at (40, 10) in the Control space: x = 100 + 40 cos 0.5 - 10 sin 0.5.
    expect(placed?.position?.x).toBeCloseTo(100 + 40 * Math.cos(0.5) - 10 * Math.sin(0.5), 5);
    expect(placed?.position?.y).toBeCloseTo(50 + 40 * Math.sin(0.5) + 10 * Math.cos(0.5), 5);
  });

  it('pushes the pose the solved Control gives, for a Container child', () => {
    const content = relayBelow('Control', '').replace(
      '[node name="Panel" type="Control" parent="."]',
      '[node name="Box" type="VBoxContainer" parent="."]\n\n[node name="Panel" type="Control" parent="Box"]'
    );
    const placed = heldPlacement(
      content.replace('"../../Held"', '"../../../Held"').replace('parent="Panel"', 'parent="Box/Panel"'),
      new Map([['Root/Box/Panel', SOLVED_PANEL]])
    );
    expect(placed?.position?.x).toBeCloseTo(100 + 40 * Math.cos(0.5) - 10 * Math.sin(0.5), 5);
  });

  it('pushes nothing before the Control walk has solved the Control', () => {
    expect(heldPlacement(relayBelow('Control', 'pivot_offset = Vector2(50, 50)'), undefined)).toBeUndefined();
  });
});
