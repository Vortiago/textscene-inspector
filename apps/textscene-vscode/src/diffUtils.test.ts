/**
 * Tests for diffUtils
 * Validates incremental change detection and update strategy decisions
 */

import { describe, it, expect } from 'vitest';
import { computeIncrementalChanges } from './diffUtils';

describe('computeIncrementalChanges', () => {

  // ============================================================================
  // Happy Path: Change Detection
  // ============================================================================

  describe('Change Detection', () => {
    it('should detect no changes when content is identical', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

      const result = computeIncrementalChanges(content, content);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(0);
      expect(result.newScene).toBeDefined();
    });

    it('should detect single node property modification', () => {
      // Use 5 nodes, modify 1 (20% change ratio) to avoid full reload
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe('update');
      expect(result.changes?.[0]?.nodePath).toBe('Root/Child4');
    });

    it('should detect node addition', () => {
      // Use 5 nodes, add 1 (17% change ratio with structure change < 30%)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]

[node name="Child5" type="Node3D" parent="."]
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe('add');
      expect(result.changes?.[0]?.nodePath).toBe('Root/Child5');
      expect(result.changes?.[0]?.parentPath).toBe('Root');
    });

    it('should detect node removal', () => {
      // Use 6 nodes, remove 1 (17% change ratio with structure change < 30%)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]

[node name="ToRemove" type="Node3D" parent="."]
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe('remove');
      expect(result.changes?.[0]?.nodePath).toBe('Root/ToRemove');
    });
  });

  // ============================================================================
  // Change Ratio Logic: Update Strategy Decisions
  // ============================================================================

  describe('Update Strategy', () => {
    it('should choose full reload when more than 50% of nodes changed', () => {
      // Scene with 2 nodes, both modified (100% change ratio)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Child" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)

[node name="Child" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0, 0)
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('full');
      expect(result.newScene).toBeDefined();
    });

    it('should choose full reload for significant structure changes (>30% with adds)', () => {
      // Scene with 3 nodes, 2 added (40% change ratio with structure change)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('full');
      expect(result.newScene).toBeDefined();
    });

    it('should choose incremental update for minor changes', () => {
      // Scene with 5 nodes, 1 modified (20% change ratio)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]

[node name="Child4" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(1);
    });
  });

  // ============================================================================
  // Complex Scenarios
  // ============================================================================

  describe('Complex Scenarios', () => {
    it('should handle multiple simultaneous changes across tree', () => {
      // 5 nodes, 2 modified (40% change ratio)
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Child4" type="Node3D" parent="."]
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="Child3" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0, 0)

[node name="Child4" type="Node3D" parent="."]
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(2);
    });

    it('should handle malformed content gracefully (lenient parser)', () => {
      // Parser is lenient and recovers from malformed content
      const malformedContent = `[gd_scene format=3]
[node name="Root" type="Node3D"
`;

      const result = computeIncrementalChanges(malformedContent, malformedContent);

      // Parser handles this gracefully, returns scene (may be empty or partial)
      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(0);
    });

    it('should detect whitespace-only changes as no changes', () => {
      const content1 = `[gd_scene format=3]
[node name="Root" type="Node3D"]
`;

      const content2 = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

      const result = computeIncrementalChanges(content1, content2);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty scene content', () => {
      const emptyContent = `[gd_scene format=3]
`;

      const result = computeIncrementalChanges(emptyContent, emptyContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(0);
    });

    it('should handle deeply nested node modifications', () => {
      const oldContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Level1" type="Node3D" parent="."]

[node name="Level2" type="Node3D" parent="Level1"]

[node name="Level3" type="Node3D" parent="Level1/Level2"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

      const newContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Level1" type="Node3D" parent="."]

[node name="Level2" type="Node3D" parent="Level1"]

[node name="Level3" type="Node3D" parent="Level1/Level2"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)
`;

      const result = computeIncrementalChanges(oldContent, newContent);

      expect(result.updateType).toBe('incremental');
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0]?.type).toBe('update');
      expect(result.changes?.[0]?.nodePath).toBe('Root/Level1/Level2/Level3');
      expect(result.changes?.[0]?.parentPath).toBe('Root/Level1/Level2');
    });
  });
});
