/**
 * StrictTscnParser: how a defect is reported — the property-format error, the
 * line and column it carries, several errors in one file, and the degenerate
 * inputs at the edges.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Invalid Property Format', () => {
    it('should report error for property without equals sign', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
invalidproperty
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('INVALID_PROPERTY_FORMAT');
      expect(result.errors[0]!.line).toBe(4);
      expect(result.errors[0]!.message).toContain('Invalid property format');
    });

    it('should accept property with empty value (parsed as empty string)', () => {
      // The parser allows "key =" format (value becomes empty string)
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible =
`;

      const result = parser.parse(content);

      // Empty value is allowed by parser (becomes empty string)
      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
      expect(result.scene!.nodes[0]!.properties['visible']).toBe('');
    });
  });

  describe('Line and Column Tracking', () => {
    it('should report accurate line numbers for errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" parent="."]

[node name="Child3" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.line).toBe(8); // Line with missing type
    });

    it('should report column 1 for all errors (no column tracking yet)', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      result.errors.forEach(error => {
        expect(error.column).toBe(1);
      });
    });
  });

  describe('Multiple Errors', () => {
    it('should report all errors found in file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]

[node type="Node3D"]

[node name="Invalid" parent="."]
invalidproperty
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      // Should have errors for: missing identifier (Root), missing name, missing identifier (Invalid), invalid property
    });

    it('still returns the scene when errors were found, so the rule phase can run', () => {
      // A bad value does not invalidate the tree. Withholding the scene made
      // `Linter` skip Phase 2 entirely, so one bad property anywhere silenced
      // every semantic rule in the file.
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.scene).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const content = '';

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const content = `; Just comments
; Nothing else
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(0);
    });

    it('should handle node with many properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
visible = true
process_mode = 0
process_priority = 0
editor_description = "Test node"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(Object.keys(result.scene!.nodes[0]!.properties)).toHaveLength(5);
    });

    it('should finalize last section at end of file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
    });
  });
});
