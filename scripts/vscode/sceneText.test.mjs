import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blankSceneText, hideSceneNode, sceneNodeNames } from './sceneText.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('blankSceneText', () => {
  it('empties every text assignment and counts them', () => {
    const source = [
      '[node name="A" type="Label"]',
      'text = "Centered label"',
      '[node name="B" type="Label"]',
      'text = "shouts when rendered"',
      'uppercase = true',
    ].join('\n');

    const result = blankSceneText(source);

    expect(result.replacements).toBe(2);
    expect(result.source).toBe(
      [
        '[node name="A" type="Label"]',
        'text = ""',
        '[node name="B" type="Label"]',
        'text = ""',
        'uppercase = true',
      ].join('\n')
    );
  });

  it('reports zero replacements for a scene with no text', () => {
    const source = '[node name="Root" type="Control"]\nanchors_preset = 15\n';

    expect(blankSceneText(source)).toEqual({ source, replacements: 0 });
  });

  it('leaves an embedded escaped quote intact and does not run past the value', () => {
    const source = 'text = "say \\"hi\\""\nhorizontal_alignment = 1\n';

    const result = blankSceneText(source);

    expect(result.replacements).toBe(1);
    expect(result.source).toBe('text = ""\nhorizontal_alignment = 1\n');
  });

  it('blanks a value whose backslash escapes a raw newline', () => {
    const source = 'text = "line\\\nnext"\nhorizontal_alignment = 1\n';

    const result = blankSceneText(source);

    expect(result.replacements).toBe(1);
    expect(result.source).toBe('text = ""\nhorizontal_alignment = 1\n');
  });

  it('ignores a text substring that is not its own assignment', () => {
    const source = 'autowrap_mode = 3\ntooltip_text = "keep me"\n';

    expect(blankSceneText(source).replacements).toBe(0);
  });

  it('blanks every label in the fixture the gate drives', () => {
    const fixture = readFileSync(path.join(REPO_ROOT, 'scenes/fixtures/unit-label-2d.tscn'), 'utf8');

    const result = blankSceneText(fixture);

    expect(result.replacements).toBeGreaterThan(0);
    expect(result.source).not.toMatch(/text = "[^"]/);
  });
});

describe('hideSceneNode', () => {
  it('hides the named node under its own header', () => {
    const source = [
      '[node name="Root" type="Node3D"]',
      '',
      '[node name="Box" type="MeshInstance3D" parent="."]',
      'mesh = SubResource("BoxMesh_1")',
    ].join('\n');

    expect(hideSceneNode(source, 'Box')).toBe(
      [
        '[node name="Root" type="Node3D"]',
        '',
        '[node name="Box" type="MeshInstance3D" parent="."]',
        'visible = false',
        'mesh = SubResource("BoxMesh_1")',
      ].join('\n')
    );
  });

  it('throws when no node has the name', () => {
    expect(() => hideSceneNode('[node name="Root" type="Node3D"]\n', 'Box')).toThrow(
      'expected a [node name="Box"] header, found none'
    );
  });

  it('matches a name with a regex character literally', () => {
    const source = '[node name="BoxA" type="Node3D"]\n[node name="Box." type="Node3D"]\n';

    expect(hideSceneNode(source, 'Box.')).toBe(
      '[node name="BoxA" type="Node3D"]\n[node name="Box." type="Node3D"]\nvisible = false\n'
    );
  });

  it('hides the box in the fixture the gate drives', () => {
    const fixture = readFileSync(path.join(REPO_ROOT, 'scenes/fixtures/unit-box-mesh.tscn'), 'utf8');

    expect(hideSceneNode(fixture, 'Box')).toMatch(/\[node name="Box"[^\n]*\]\nvisible = false\n/);
  });
});

describe('sceneNodeNames', () => {
  it('lists every node name in heading order', () => {
    const source = [
      '[gd_scene format=3]',
      '[node name="Root" type="Node3D"]',
      '[node name="Box" type="MeshInstance3D" parent="."]',
      '[node name="Lamp" type="OmniLight3D" parent="Box"]',
    ].join('\n');

    expect(sceneNodeNames(source)).toEqual(['Root', 'Box', 'Lamp']);
  });

  it('lists nothing for a resource with no nodes', () => {
    expect(sceneNodeNames('[gd_resource type="BoxMesh" format=3]\n\n[resource]\n')).toEqual([]);
  });

  it('skips a name that only appears inside a value', () => {
    const source = ['[node name="Root" type="Node3D"]', 'text = "[node name=\\"Fake\\"]"'].join('\n');

    expect(sceneNodeNames(source)).toEqual(['Root']);
  });

  it('lists the committed box fixture the gate reads', () => {
    const source = readFileSync(path.join(REPO_ROOT, 'scenes/fixtures/unit-box-mesh.tscn'), 'utf8');

    expect(sceneNodeNames(source)).toEqual(['Root', 'Box', 'Title', 'Description']);
  });
});
