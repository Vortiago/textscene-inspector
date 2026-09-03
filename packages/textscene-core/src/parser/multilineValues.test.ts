/**
 * Values that Godot's token-based reader takes across physical lines and the
 * `;` comments it skips: both must survive the line-based scan here.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser';
import type { TscnNode } from './types';
import type { Line2DProperties } from '../nodes/2d/line2d/types';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { LabelProperties } from '../nodes/2d/ui/label/types';

function find(nodes: readonly TscnNode[], name: string): TscnNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = find(n.children, name);
    if (hit) return hit;
  }
  return undefined;
}

describe('a value whose paren closes on a later line', () => {
  it('rejoins a hand-written multi-line PackedVector2Array and reads the property after it', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="GridLines" type="Line2D"]
points = PackedVector2Array(
	0, 0, 2000, 0,
	2000, 0, 2000, 2000
)
width = 7.0
`);
    const props = find(scene.nodes, 'GridLines')!.properties as Line2DProperties;
    expect(Array.from(props.points)).toEqual([0, 0, 2000, 0, 2000, 0, 2000, 2000]);
    expect(props.width).toBe(7);
  });

  it("rejoins Godot's own nested Object(…) shape, which ends each inner object with a newline", () => {
    // variant_parser.cpp:2234 writes `)\n` after every Object, so an object
    // stored inside an exported object continues on the next line.
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Fence" type="Node3D"]
metadata/effect = Object(Area3D,"monitoring":true,"audio":Object(Timer,"wait_time":0.5)
,"targets":{},"tick":Object(Timer,"one_shot":false)
,"metadata/_custom_type_script":"uid://c4a2vg4id0rom")
visible = false
`);
    const fence = find(scene.nodes, 'Fence')!;
    expect(fence.rawProperties?.['metadata/effect']).toBe(
      'Object(Area3D,"monitoring":true,"audio":Object(Timer,"wait_time":0.5)\n' +
        ',"targets":{},"tick":Object(Timer,"one_shot":false)\n' +
        ',"metadata/_custom_type_script":"uid://c4a2vg4id0rom")'
    );
    expect((fence.properties as { visible?: boolean }).visible).toBe(false);
  });
});

describe('`;` comments', () => {
  it('drops a trailing comment before the value is read, and a comment-only line', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

; the root
[node name="Root" type="Node2D"]
position = Vector2(3, 4) ; nudged right
scale = Vector2(2, 2)
`);
    const props = find(scene.nodes, 'Root')!.properties as Node2DProperties;
    expect(props.position).toEqual({ x: 3, y: 4 });
    expect(props.scale).toEqual({ x: 2, y: 2 });
  });

  it('keeps a `;` that sits inside a multi-line string', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Title" type="Label"]
text = "Field Notes
Volume; Two"
`);
    const props = find(scene.nodes, 'Title')!.properties as LabelProperties;
    expect(props.text).toBe('Field Notes\nVolume; Two');
  });
});
