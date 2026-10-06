/** A node's path from the scene root, as a later heading's `parent=` names it. */

import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { nodePathOf } from './nodePath';

function pathsOf(text: string): (string | undefined)[] {
  return new LanguageDocument(text).sections.map(nodePathOf);
}

describe('nodePathOf', () => {
  it('names the root ., its child by name, and a deeper node by its path', () => {
    const paths = pathsOf(
      [
        '[node name="Root" type="Node3D"]',
        '[node name="Body" type="Node3D" parent="."]',
        '[node name="Arm" type="Node3D" parent="Body"]',
      ].join('\n')
    );
    expect(paths).toEqual(['.', 'Body', 'Body/Arm']);
  });

  it('gives no path to a node whose name is empty', () => {
    expect(pathsOf('[node name="" type="Node3D" parent="."]')).toEqual([undefined]);
  });

  it('gives no path to a node with no name attribute', () => {
    expect(pathsOf('[node type="Node3D" parent="."]')).toEqual([undefined]);
  });
});
