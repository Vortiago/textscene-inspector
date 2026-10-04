import { describe, expect, it } from 'vitest';
import { formatSceneTree } from './sceneTree';

describe('formatSceneTree', () => {
  it('indents each node under its parent', () => {
    const text = [
      '[node name="Root" type="Node3D"]',
      '[node name="Body" type="MeshInstance3D" parent="."]',
      '[node name="Arm" type="MeshInstance3D" parent="Body"]',
    ].join('\n');
    expect(formatSceneTree('Main.tscn', text)).toBe(
      ['Main.tscn:', '  Root (Node3D)', '    Body (MeshInstance3D)', '      Arm (MeshInstance3D)'].join('\n')
    );
  });

  it('names the scene a node instances', () => {
    const text = '[node name="Door" type="Node3D" instance=ExtResource("1")]';
    expect(formatSceneTree('Main.tscn', text)).toContain('  Door (Node3D) instance=ExtResource("1")');
  });

  it('lists only the file name for an empty scene', () => {
    expect(formatSceneTree('Empty.tscn', '[gd_scene format=3]')).toBe('Empty.tscn:');
  });
});
