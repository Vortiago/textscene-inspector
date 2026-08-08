/**
 * StrictTscnParser: the ValidatorRegistry hand-off — which nodes get their
 * properties validated, and which are skipped for want of a known type.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

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
});
