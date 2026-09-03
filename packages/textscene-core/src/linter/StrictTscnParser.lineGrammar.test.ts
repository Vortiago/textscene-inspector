/**
 * StrictTscnParser: values Godot's token-based reader spreads over several
 * physical lines, and the `;` comments it skips, reach the validators whole.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
// Registers every slice's validators; without it nothing is validated.
import './index.js';

describe('StrictTscnParser line grammar', () => {
  it('reads a PackedVector2Array whose paren closes on a later line', () => {
    const result = new StrictTscnParser().parse(`[gd_scene format=3]

[node name="GridLines" type="Line2D"]
points = PackedVector2Array(
	0, 0, 2000, 0,
	2000, 0, 2000, 2000
)
width = 7.0
`);
    expect(result.errors).toEqual([]);
  });

  it("reads Godot's nested Object(…) shape, which ends each inner object with a newline", () => {
    const result = new StrictTscnParser().parse(`[gd_scene format=3]

[node name="Fence" type="Node3D"]
metadata/effect = Object(Area3D,"monitoring":true,"audio":Object(Timer,"wait_time":0.5)
,"targets":{},"tick":Object(Timer,"one_shot":false)
,"metadata/_custom_type_script":"uid://c4a2vg4id0rom")
visible = false
`);
    expect(result.errors).toEqual([]);
  });

  it('validates the value in front of a `;` comment, not the comment', () => {
    const result = new StrictTscnParser().parse(`[gd_scene format=3]

; the root
[node name="Root" type="Node2D"]
scale = Vector2(2, 2) ; nudged
`);
    expect(result.errors).toEqual([]);
  });

  it('still refuses a value that is wrong before the comment starts', () => {
    const result = new StrictTscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]
scale = Vector2(2) ; short one
`);
    expect(result.errors.map((e) => e.code)).toEqual(['INVALID_SCALE_FORMAT']);
  });
});
