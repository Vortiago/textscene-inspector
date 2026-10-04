import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { LINE, SCENE } from './fixtures.testkit';
import { hoverAt } from './hover';

function at(document: LanguageDocument, line: number, needle: string, offset = 1) {
  const text = document.lines[line - 1]!;
  return hoverAt(document, { line: line - 1, character: text.indexOf(needle) + offset });
}

describe('hoverAt', () => {
  it('names a node class, its chain and its reference page', () => {
    const document = new LanguageDocument(SCENE);
    const hover = at(document, LINE.rootNode, 'Node3D', 2);
    expect(hover?.markdown).toContain('**Node3D**');
    expect(hover?.markdown).toContain('Godot class, extends `Node`');
    expect(hover?.markdown).toContain('https://docs.godotengine.org/en/stable/classes/class_node3d.html');
  });

  it('describes a property with its type, declaring class and accepted resource', () => {
    const document = new LanguageDocument(SCENE);
    const hover = at(document, LINE.meshProperty, 'mesh', 0);
    expect(hover?.markdown).toContain('**mesh** `Object`');
    expect(hover?.markdown).toContain('Declared by `MeshInstance3D`');
    expect(hover?.markdown).toContain('A resource of `Mesh`');
  });

  it('lists the labels of an enum property', () => {
    const document = new LanguageDocument(SCENE);
    const hover = at(document, LINE.rootProperty, 'rotation_edit_mode', 0);
    expect(hover?.markdown).toContain('`Euler` (0)');
    expect(hover?.markdown).toContain('`Basis` (2)');
  });

  it('resolves a resource reference to its declaration', () => {
    const document = new LanguageDocument(SCENE);
    const hover = at(document, LINE.meshProperty, 'SubResource', 3);
    expect(hover?.markdown).toContain('Sub-resource `BoxMesh_1`');
    expect(hover?.markdown).toContain('`BoxMesh`');
  });

  it('reports an enum value as its label', () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.rootProperty - 1]!;
    const hover = hoverAt(document, { line: LINE.rootProperty - 1, character: text.indexOf('=') + 2 });
    expect(hover?.markdown).toContain('**Euler**');
  });

  it('answers nothing on a blank line and on an unknown class', () => {
    const document = new LanguageDocument(SCENE);
    expect(hoverAt(document, { line: 1, character: 0 })).toBeUndefined();
    const custom = new LanguageDocument('[node name="R" type="MyScriptClass"]');
    expect(hoverAt(custom, { line: 0, character: 22 })).toBeUndefined();
  });

  it('does not read a multiline value continuation as a property key', () => {
    const text = ['[node name="R" type="Node3D"]', 'metadata = {', '\t"a=b": 1', '}'].join('\n');
    expect(hoverAt(new LanguageDocument(text), { line: 2, character: 2 })).toBeUndefined();
  });
});
