/**
 * StrictTscnParser: a heading whose syntax is fine but whose required
 * attributes are not — no `name`, and no `type`/`instance` to identify the node
 * by.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Missing Node Name', () => {
    it('should report error when node has no name attribute', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_NAME');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('name=');
    });
  });

  describe('Missing Node Identifier', () => {
    it('refuses the scene when heading 0 has neither type= nor instance=', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      // The loader takes the absence as TYPE_INSTANTIATED
      // (resource_format_text.cpp:218-221) and sets `base_scene` only under
      // `if (next_tag.fields.has("instance"))` (:236-239), so heading 0 hits
      // `ERR_FAIL_COND_V_MSG(n.type == TYPE_INSTANTIATED && base_scene_idx < 0,
      // nullptr, "Invalid scene: root node %s in an instance, but there's no
      // base scene.")` (packed_scene.cpp:220): the instantiate is refused.
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_IDENTIFIER');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('type=');
      expect(result.errors[0]!.message).toContain('instance=');
      expect(result.errors[0]!.message).toContain('refuses');
    });

    it('index= does not rescue heading 0', () => {
      // Only `instance` sets `base_scene` (resource_format_text.cpp:236-239);
      // `index` is read at :270-272 and changes nothing about the type.
      const result = parser.parse(`[gd_scene format=3]

[node name="Root" index="0"]
`);
      expect(result.errors.map((e) => [e.code, e.severity])).toEqual([
        ['MISSING_NODE_IDENTIFIER', 'error'],
      ]);
    });

    it('warns, not errors, on a later heading with no type=, index= or instance=', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      // The `i > 0` arm: Godot only warns at load if nothing instantiates the
      // node — "was modified from inside an instance, but it has vanished."
      // (packed_scene.cpp:309-311).
      expect(result.errors[0]!.severity).toBe('warning');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_IDENTIFIER');
      expect(result.errors[0]!.line).toBe(5);
      expect(result.errors[0]!.message).toContain('type=');
      expect(result.errors[0]!.message).toContain('index=');
      expect(result.errors[0]!.message).toContain('instance=');
    });

    it('should accept node with type attribute', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept node with index attribute (instanced scene child)', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Enemy" type="Node3D"]

[node name="@Sprite2D@123" index="0" parent="Enemy"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });

    it('parses an index-only child node without polluting its properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="@Child@123" index="0" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.name).toBe('@Child@123');
      // No `__`-prefixed metadata smuggled into the property schema.
      expect((childNode.properties as Record<string, unknown>)['__instance_index']).toBeUndefined();
    });

    it('exposes an instance reference on node.instance, not a __instance property', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1_abc"]

[node name="Root" type="Node3D"]

[node name="Enemy1" instance=ExtResource("1_abc") parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.instance).toBe('ExtResource("1_abc")');
      expect((childNode.properties as Record<string, unknown>)['__instance']).toBeUndefined();
    });
  });
});
