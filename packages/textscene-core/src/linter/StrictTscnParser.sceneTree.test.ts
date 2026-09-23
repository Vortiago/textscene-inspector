/**
 * StrictTscnParser: assembling the parsed sections into a scene tree.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Scene Tree Building', () => {
    it('should build correct parent-child relationships', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child1"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.children).toHaveLength(2);
      // Children are added in the order they are processed (backward iteration).
      const childNames = result.scene!.nodes[0]!.children.map(c => c.name);
      expect(childNames).toContain('Child1');
      expect(childNames).toContain('Child2');

      const child1 = result.scene!.nodes[0]!.children.find(c => c.name === 'Child1')!;
      expect(child1.children).toHaveLength(1);
      expect(child1.children[0]!.name).toBe('GrandChild');
    });

    it('should handle first node as root (only returns one root)', () => {
      // buildSceneTree only returns the first root node
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root1" type="Node3D"]

[node name="Root2" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      // Only the first root node is returned
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.name).toBe('Root1');
    });

    it('should set parent property when parent specified', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.parent).toBe('.');
    });

    it('should not set parent property for root nodes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.parent).toBeUndefined();
    });
  });
});
