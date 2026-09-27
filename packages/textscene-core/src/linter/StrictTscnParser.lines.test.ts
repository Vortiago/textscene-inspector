/**
 * StrictTscnParser: the line table it returns beside the scene. `Linter` reads it to put a rule's
 * diagnostic on its node's heading, and a dangling reference on its property's line.
 */

import { describe, it, expect } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import type { TscnNode } from '../parser/types.js';
// The barrel registers the validators, so a refused value is refused.
import './index.js';

function parse(content: string) {
  const result = new StrictTscnParser().parse(content);
  return { ...result, root: result.scene!.nodes[0]! };
}

describe('StrictTscnParser line table', () => {
  it("records each node's heading and the line of each property under it", () => {
    const { lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false
z_index = 2

[node name="Child" type="Node2D" parent="."]
position = Vector2(1, 2)
`);
    const child = root.children[0]!;

    expect(lines.get(root)?.heading).toBe(3);
    expect([...lines.get(root)!.properties]).toEqual([
      ['visible', 4],
      ['z_index', 5],
    ]);
    expect(lines.get(child)?.heading).toBe(7);
    expect(lines.get(child)?.properties.get('position')).toBe(8);
  });

  it('records a sub-resource under the object the scene holds', () => {
    const { lines, scene } = parse(`[gd_scene format=3]

[sub_resource type="BoxMesh" id="Box_1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
`);
    const box = scene!.internalResources[0]!;

    expect(lines.get(box)).toEqual({ heading: 3, properties: new Map([['size', 4]]) });
  });

  it('keeps the line of a property whose value the validators refuse', () => {
    // A refused value still sits in the bag, and the rules still read it.
    const { errors, lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(nope)
`);

    expect(errors).toHaveLength(1);
    expect(lines.get(root)?.properties.get('position')).toBe(4);
  });

  it('files a deprecated spelling under the key the bag stores it at', () => {
    // `frames` is `sprite_frames` on AnimatedSprite2D (animated_sprite_2d.cpp:617).
    const { lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="AnimatedSprite2D"]
frames = SubResource("f")
`);

    expect(root.properties).toHaveProperty('sprite_frames');
    expect([...lines.get(root)!.properties]).toEqual([['sprite_frames', 4]]);
  });

  it('keeps the last line of a key written twice, as the bag keeps the last value', () => {
    const { lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]
z_index = 1
z_index = 2
`);

    expect((root.properties as Record<string, string>).z_index).toBe('2');
    expect(lines.get(root)?.properties.get('z_index')).toBe(5);
  });

  it('records a multi-line value at the line it starts on', () => {
    const { lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="Label"]
text = "first
second"
visible = true
`);

    expect([...lines.get(root)!.properties]).toEqual([
      ['text', 4],
      ['visible', 6],
    ]);
  });

  it("mirrors the bag where the scan's recovery reads a heading with no ']' as a property", () => {
    // The lenient loop keeps the broken line and what follows it in the section above,
    // and the bag is what the rules read, so the table must name the same keys.
    const { lines, root } = parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Broken" type="Node2D"
z_index = 3
`);

    expect([...lines.get(root)!.properties.keys()]).toEqual(Object.keys(root.properties));
    expect(lines.get(root)?.properties.get('z_index')).toBe(7);
  });

  it('records nothing for a section that builds no node or sub-resource', () => {
    const { lines } = new StrictTscnParser().parse(`[gd_resource type="Environment" format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[resource]
background_mode = 1
`);

    expect(lines.size).toBe(0);
  });

  it('holds exactly one entry for every node of the tree', () => {
    const { lines, scene } = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="A" type="Node3D" parent="."]

[node name="B" type="Node3D" parent="A"]
`);
    const walk = (nodes: readonly TscnNode[]): TscnNode[] =>
      nodes.flatMap((node) => [node, ...walk(node.children)]);

    expect(walk(scene!.nodes).map((node) => lines.get(node)?.heading)).toEqual([3, 5, 7]);
    expect(lines.size).toBe(3);
  });
});
