import { describe, expect, it } from 'vitest';
import { nodeHeadingLine } from './nodeHeadingResolver';

// Two nodes named "Leaf", under A (line 4) and under B (line 5).
const TWO_SIBLINGS = [
  '[gd_scene format=3]',
  '[node name="Root" type="Node3D"]',
  '[node name="A" type="Node3D" parent="."]',
  '[node name="B" type="Node3D" parent="."]',
  '[node name="Leaf" type="Node3D" parent="A"]',
  '[node name="Leaf" type="Node3D" parent="B"]',
].join('\n');

describe('nodeHeadingLine', () => {
  it('resolves a duplicate name to the sibling its tree path names', () => {
    expect([
      nodeHeadingLine(TWO_SIBLINGS, 'Root/A/Leaf'),
      nodeHeadingLine(TWO_SIBLINGS, 'Root/B/Leaf'),
    ]).toEqual([4, 5]);
  });

  it('distinguishes a direct child of the root from a deeper node of the same name', () => {
    const text = [
      '[gd_scene format=3]',
      '[node name="Root" type="Node3D"]',
      '[node name="A" type="Node3D" parent="."]',
      '[node name="Item" type="Node3D" parent="A"]',
      '[node name="Item" type="Node3D" parent="."]',
    ].join('\n');
    expect(nodeHeadingLine(text, 'Root/Item')).toBe(4);
  });

  it('resolves a child whose parent is spelt ./ to the node Godot seats there', () => {
    const text = ['[node name="Root" type="Node3D"]', '[node name="Arm" type="Node3D" parent="./"]'].join(
      '\n'
    );
    expect(nodeHeadingLine(text, 'Root/Arm')).toBe(1);
  });

  it('resolves the root', () => {
    expect(nodeHeadingLine(TWO_SIBLINGS, 'Root')).toBe(1);
  });

  it('resolves a root heading that declares parent="."', () => {
    const text = [
      '[node name="Root" type="Node3D" parent="."]',
      '[node name="Arm" type="Node3D" parent="."]',
    ].join('\n');
    expect([nodeHeadingLine(text, 'Root'), nodeHeadingLine(text, 'Root/Arm')]).toEqual([0, 1]);
  });

  it('gives nothing for a node the file does not declare', () => {
    expect(nodeHeadingLine(TWO_SIBLINGS, 'Root/Nope')).toBeUndefined();
  });
});
