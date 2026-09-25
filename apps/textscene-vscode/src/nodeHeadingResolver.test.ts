/**
 * Unit tests for the shared `[node …]` heading resolver.
 */
import { describe, expect, it } from 'vitest';
import { findNodeHeadingLine } from './nodeHeadingResolver';

// Two nodes named "Leaf", under A (line 4) and under B (line 5).
const TWO_SIBLINGS_LINES = [
  '[gd_scene format=3]',
  '[node name="Root" type="Node3D"]',
  '[node name="A" type="Node3D" parent="."]',
  '[node name="B" type="Node3D" parent="."]',
  '[node name="Leaf" type="Node3D" parent="A"]',
  '[node name="Leaf" type="Node3D" parent="B"]',
];

describe('findNodeHeadingLine', () => {
  it('resolves a duplicate name to the sibling identified by parent (B)', () => {
    expect(findNodeHeadingLine(TWO_SIBLINGS_LINES, 'Leaf', 'B')).toBe(5);
  });

  it('resolves the other duplicate sibling by parent (A)', () => {
    expect(findNodeHeadingLine(TWO_SIBLINGS_LINES, 'Leaf', 'A')).toBe(4);
  });

  it('distinguishes a direct child of root (parent=".") from a deeper duplicate', () => {
    // "Item" appears twice: under "A" (line 3) and directly under root (line 4).
    const lines = [
      '[gd_scene format=3]',
      '[node name="Root" type="Node3D"]',
      '[node name="A" type="Node3D" parent="."]',
      '[node name="Item" type="Node3D" parent="A"]',
      '[node name="Item" type="Node3D" parent="."]',
    ];

    expect(findNodeHeadingLine(lines, 'Item', '.')).toBe(4);
  });

  it('resolves the root node (no parent) to its heading', () => {
    expect(findNodeHeadingLine(TWO_SIBLINGS_LINES, 'Root')).toBe(1);
  });

  it('falls back to the first name match when no parent is supplied (legacy)', () => {
    expect(findNodeHeadingLine(TWO_SIBLINGS_LINES, 'Leaf')).toBe(4);
  });

  it('returns -1 when the node is absent', () => {
    expect(findNodeHeadingLine(TWO_SIBLINGS_LINES, 'Nope', 'Root')).toBe(-1);
  });
});
