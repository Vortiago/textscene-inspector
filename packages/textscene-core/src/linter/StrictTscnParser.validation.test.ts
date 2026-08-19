/**
 * StrictTscnParser: the ValidatorRegistry hand-off — which nodes get their
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
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

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

    it('should not validate properties in sub_resources', () => {
      // Sub_resource properties are not type-validated
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      // Sub_resources are parsed but properties aren't validated
      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
    });
  });

  /**
   * A standalone `.tres` puts its properties in a bare `[resource]` section and
   * declares their type once, in the file header: `res_type = tag.fields["type"]`
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
      // nodes below it.
      const content = `[gd_scene format=3]

[node name="Root" index="0"]
background_mode = 99
`;

      expect(parser.parse(content).errors).toHaveLength(0);
    });
  });
});
