/**
 * StrictTscnParser: the ValidatorRegistry hand-off: which nodes get their
 * properties validated, and which are skipped for want of a known type.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
// The barrel, so the slices have self-registered their validators: the
// standalone-`.tres` cases below assert a real Environment bound fires, and a
// direct `./StrictTscnParser.js` import lints every file into silence.
import './index.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Property Validation via ValidatorRegistry', () => {
    it('should skip validation for nodes with index attribute (unknown type)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

[node name="@Child@123" index="0" parent="."]
visible = invalid_value
`;

      const result = parser.parse(content);

      // No validation errors because node type is unknown (index= node)
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation for nodes with instance attribute (unknown type)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Enemy1" instance=ExtResource("1") parent="."]
visible = invalid_value
`;

      const result = parser.parse(content);

      // No validation errors because node type is unknown (instance= node)
      expect(result.errors).toHaveLength(0);
    });

    it('validates a sub_resource body against its own heading type', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
    });
  });

  /**
   * Which of a file's sub-resources a refusal is about. `[sub_resource]` bodies run the full validator set, and a scene
   * often carries several sub-resources of one type, which only the heading's `id=` tells apart.
   */
  describe('sub-resource attribution', () => {
    const content = `[gd_scene load_steps=3 format=3]

[sub_resource type="CircleShape2D" id="CircleShape2D_1"]
radius = 8.0

[sub_resource type="CircleShape2D" id="CircleShape2D_2"]
radius = -1.0

[node name="Root" type="Node2D"]
`;

    it('names the sub-resource by its id and type', () => {
      const errors = parser.parse(content).errors;

      expect(errors).toHaveLength(1);
      expect(errors[0]?.nodeName).toBe('CircleShape2D_2');
      expect(errors[0]?.nodeType).toBe('CircleShape2D');
    });

    it('does not leak a sub-resource name onto the node that follows it', () => {
      const errors = parser.parse(`${content}invalidproperty\n`).errors;
      const malformed = errors.find((e) => e.code === 'INVALID_PROPERTY_FORMAT');

      expect(malformed?.nodeName).toBe('Root');
      expect(malformed?.nodeType).toBe('Node2D');
    });

    it('leaves a .tres [resource] body unattributed, since no id names it', () => {
      const tres = `[gd_resource type="Environment" format=3]

[resource]
background_mode = 99
`;

      expect(parser.parse(tres).errors[0]?.nodeName).toBeUndefined();
    });
  });

  /**
   * A standalone `.tres` puts its properties in a bare `[resource]` section and
   * declares their type in the file header: `res_type = tag.fields["type"]`
   * (resource_format_text.cpp:1166) is what `ClassDB::instantiate(res_type)`
   * builds when the `resource` tag opens (:741).
   */
  describe('a standalone .tres [resource] body', () => {
    it('validates against the type the [gd_resource] header names', () => {
      const content = `[gd_resource type="Environment" format=3]

[resource]
background_mode = 99
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('INVALID_BACKGROUND_MODE_VALUE');
      expect(result.errors[0]?.line).toBe(4);
    });

    it('inherits the header type\'s base validators', () => {
      // `resource_local_to_scene` is Resource's, not Environment's.
      const content = `[gd_resource type="Environment" format=3]

[resource]
resource_local_to_scene = 7
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('resource_local_to_scene');
    });

    it('validates nothing when the header names no type', () => {
      // A typeless header is not loadable either ("Missing 'type' field in
      // 'gd_resource' tag", resource_format_text.cpp:1153-1159), but nothing
      // here knows what the body was meant to be, so it reports no bound.
      const content = `[gd_resource format=3]

[resource]
background_mode = 99
`;

      expect(parser.parse(content).errors).toHaveLength(0);
    });

    it('validates nothing for a [resource] section with no header above it', () => {
      expect(parser.parse('[resource]\nbackground_mode = 99\n').errors).toHaveLength(0);
    });

    it('leaves a scene file\'s own sections judged by their own headings', () => {
      // A `[gd_scene]` header carries no `type=`, so nothing leaks into the
      // nodes below it: the index-only child is judged by its own heading.
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

[node name="Child" parent="." index="0"]
background_mode = 99
`;

      expect(parser.parse(content).errors).toHaveLength(0);
    });
  });
  describe('a TileSet family key with no index or no leaf', () => {
    // `TileSet::_set` gates each family on `trim_prefix(...).is_valid_int()`
    // (tile_set.cpp:3893, :3995), which the empty index fails, and an empty
    // `components[1]` matches no leaf branch (:3897, :3904); each falls out of
    // the chain as `return false`, a dropped write.
    it('reports each shape once', () => {
      const content = `[gd_scene format=3]

[sub_resource type="TileSet" id="1"]
terrain_set_/mode = 0
terrain_set_0/ = 0
pattern_ = null
terrain_set_0/mode = 0

[node name="Root" type="Node2D"]
`;
      const errors = parser.parse(content).errors;
      expect(errors.map((e) => [e.line, e.severity, e.code])).toEqual([
        [4, 'error', 'INVALID_TILESET_TERRAIN_SET_KEY'],
        [5, 'error', 'INVALID_TILESET_TERRAIN_SET_KEY'],
        [6, 'error', 'INVALID_TILESET_PATTERN_KEY'],
      ]);
    });
  });

  describe('an indexed key with no leaf, a nested leaf, or no index', () => {
    // `PropertyListHelper::_get_property` splits at the last `/` (property_list_helper.cpp:47): `item_0/` and
    // `item_/text` hand it an index half `!index_string.is_valid_int()` refuses (:53), and `item_0/text/extra` an index
    // half of `0/text`. Each is a dropped write, so each must reach the family dispatcher.
    it('reports each of the three shapes Godot drops, once', () => {
      const content = `[gd_scene format=3]

[node name="Menu" type="PopupMenu"]
item_0/ = "x"
item_0/text/extra = "x"
item_/text = "x"
item_0/text = "x"
`;
      const errors = parser.parse(content).errors;
      expect(errors.map((e) => [e.line, e.severity, e.code])).toEqual([
        [4, 'error', 'INVALID_ITEM_KEY'],
        [5, 'error', 'INVALID_ITEM_KEY'],
        [6, 'error', 'INVALID_ITEM_KEY'],
      ]);
    });
  });
});
