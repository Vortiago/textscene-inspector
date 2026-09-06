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

    it('warns, not errors, on a later heading with no type= or instance= and no instanced ancestor', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      // The `i > 0` arm: Godot only warns at load if nothing instantiates the
      // node — "was modified from inside an instance, but it has vanished."
      // (packed_scene.cpp:310).
      expect(result.errors[0]!.severity).toBe('warning');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_IDENTIFIER');
      expect(result.errors[0]!.line).toBe(5);
      expect(result.errors[0]!.message).toContain('type=');
      expect(result.errors[0]!.message).toContain('instance=');
      expect(result.errors[0]!.message).toContain('vanished');
    });

    it('should accept node with type attribute', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept node with index attribute (instanced scene child)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="@Sprite2D@123" index="0" parent="Enemy"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });

    it('parses an index-only child node without polluting its properties', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

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

  describe('a type-less heading is judged by its instanced ancestry', () => {
    it('accepts an instance_placeholder heading — Godot builds an InstancePlaceholder there', () => {
      // resource_format_text.cpp:242-254 folds the path into `instance` with
      // FLAG_INSTANCE_IS_PLACEHOLDER; packed_scene.cpp:239-258 builds the node
      // and applies the heading's properties to it.
      const result = parser.parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]
position = Vector2(5, 5)
`);
      expect(result.errors).toEqual([]);
      expect(result.scene!.nodes[0]!.children[0]!.type).toBe('InstancePlaceholder');
    });

    it('refuses instance_placeholder on the root heading', () => {
      // "Instance Placeholder can't be used for inheritance" — ERR_FILE_CORRUPT
      // (resource_format_text.cpp:247-251).
      const result = parser.parse(`[gd_scene format=3]

[node name="Root" instance_placeholder="res://rock.tscn"]
`);
      expect(result.errors.map((e) => [e.code, e.severity, e.line])).toEqual([
        ['INSTANCE_PLACEHOLDER_ROOT', 'error', 3],
      ]);
    });

    it('still warns under an instance_placeholder: the placeholder has no children', () => {
      // packed_scene.cpp:255 builds an InstancePlaceholder, and it is childless
      // until something replaces it, so the lookup at :283 fails exactly as it
      // does with no instance at all. Verified against Godot: the child is
      // dropped with "was modified from inside an instance, but it has
      // vanished."
      const result = parser.parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]

[node name="Inner" parent="Rock"]
`);
      expect(result.errors.map((e) => [e.code, e.severity, e.line])).toEqual([
        ['MISSING_NODE_IDENTIFIER', 'warning', 7],
      ]);
    });

    it('still warns beside a nameless instance heading, which stores no path', () => {
      // A heading with no `name=` joins to the empty path, and `parent=""`
      // names nothing to walk up from: matching the two would let one
      // unrelated malformed heading vouch for the other.
      const result = parser.parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rock.tscn" id="1"]

[node name="Root" type="Node2D"]

[node parent="." instance=ExtResource("1")]

[node name="Inner" parent=""]
`);
      expect(result.errors.map((e) => [e.code, e.severity, e.line])).toEqual([
        ['MISSING_NODE_NAME', 'error', 7],
        ['MISSING_NODE_IDENTIFIER', 'warning', 9],
      ]);
    });

    it('accepts an override anywhere below an instanced ancestor — Godot writes it without index=', () => {
      const result = parser.parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://warp.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="WarpZones" type="Node2D" parent="."]

[node name="WarpDown" parent="WarpZones" instance=ExtResource("1")]

[node name="CollisionShape2D" parent="WarpZones/WarpDown"]
disabled = true

[node name="Deep" parent="WarpZones/WarpDown/CollisionShape2D"]
`);
      expect(result.errors).toEqual([]);
    });

    it('accepts a type-less child of an inherited scene', () => {
      const result = parser.parse(`[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

[node name="Light" parent="."]
visible = false
`);
      expect(result.errors).toEqual([]);
    });

    it('index= does not rescue a child with no instance above it — Godot drops it', () => {
      // packed_scene.cpp:283 looks a TYPE_INSTANTIATED node up by name under
      // the parent; :310 "was modified from inside an instance, but it has
      // vanished." is all that is left when nothing instanced is there.
      const result = parser.parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Child" parent="." index="0"]
`);
      expect(result.errors.map((e) => [e.code, e.severity, e.line])).toEqual([
        ['MISSING_NODE_IDENTIFIER', 'warning', 5],
      ]);
    });
  });
});
