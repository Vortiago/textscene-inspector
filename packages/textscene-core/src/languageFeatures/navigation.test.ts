/** Navigation targets: a resource id's declaration heading and every res:// path. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { declarationRangeAt, resPathAt, resPathOccurrences } from './navigation';

const SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]

[sub_resource type="Animation" id="Anim_1"]

[node name="Root" type="Node3D"]
texture = ExtResource("1_abc")
anim = SubResource("Anim_1")
paths = ["res://a.png", "res://b.png"]
`;

const document = new LanguageDocument(SCENE);

describe('declarationRangeAt', () => {
  it('resolves an ExtResource reference to its declaration heading', () => {
    expect(declarationRangeAt(document, { line: 7, character: 15 })).toEqual({
      start: { line: 2, character: 0 },
      end: {
        line: 2,
        character: '[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]'.length,
      },
    });
  });

  it('resolves a SubResource reference to its declaration heading', () => {
    expect(declarationRangeAt(document, { line: 8, character: 10 })?.start.line).toBe(4);
  });

  it("resolves a declaration's own id= to its heading", () => {
    const line = document.lines[4]!;
    expect(declarationRangeAt(document, { line: 4, character: line.indexOf('Anim_1') + 1 })?.start.line).toBe(
      4
    );
  });

  it('gives nothing off every reference', () => {
    expect(declarationRangeAt(document, { line: 9, character: 0 })).toBeUndefined();
  });

  it('gives nothing for a reference whose declaration is absent', () => {
    const dangling = new LanguageDocument('texture = ExtResource("missing")\n');

    expect(declarationRangeAt(dangling, { line: 0, character: 12 })).toBeUndefined();
  });
});

describe('resPathAt', () => {
  it('finds the path the cursor sits on', () => {
    const found = resPathAt(document, { line: 2, character: 55 });

    expect(found).toEqual({
      path: 'res://icon.png',
      range: { start: { line: 2, character: 53 }, end: { line: 2, character: 67 } },
    });
  });

  it('gives nothing when the cursor is off the path', () => {
    expect(resPathAt(document, { line: 2, character: 0 })).toBeUndefined();
  });

  it('gives nothing on a line past the document', () => {
    expect(resPathAt(document, { line: 99, character: 0 })).toBeUndefined();
  });
});

describe('resPathOccurrences', () => {
  it('finds every res:// occurrence, two on one line included', () => {
    const links = resPathOccurrences(document);

    expect(links.map((link) => link.path)).toEqual(['res://icon.png', 'res://a.png', 'res://b.png']);
    expect(links[1]!.range.start.line).toBe(9);
    expect(links[1]!.range.end.character).toBeGreaterThan(links[1]!.range.start.character);
  });

  it('keeps a space in a path to its closing quote', () => {
    const scene = new LanguageDocument(
      '[ext_resource type="AudioStream" path="res://art/House In a Forest Loop.ogg" id="1"]\n'
    );

    expect(resPathOccurrences(scene).map((link) => link.path)).toEqual([
      'res://art/House In a Forest Loop.ogg',
    ]);
  });

  it('keeps a parenthesis in a path to its closing quote', () => {
    const scene = new LanguageDocument('[ext_resource type="Texture2D" path="res://icon (1).png" id="1"]\n');

    expect(resPathOccurrences(scene).map((link) => link.path)).toEqual(['res://icon (1).png']);
  });

  it('ends a path in an escaped string before its escaped closing quote', () => {
    const scene = new LanguageDocument('script/source = "var t = preload(\\"res://a.png\\")"\n');

    expect(resPathOccurrences(scene).map((link) => link.path)).toEqual(['res://a.png']);
  });

  it('ends a path with no quote before it at the next space', () => {
    const scene = new LanguageDocument('editor_description = "uses res://a.png for the floor"\n');

    expect(resPathOccurrences(scene).map((link) => link.path)).toEqual(['res://a.png']);
  });

  it('ends a sub-resource address at the file it names', () => {
    const scene = new LanguageDocument('[ext_resource type="Mesh" path="res://lib.tres::Mesh_1" id="1"]\n');

    expect(resPathOccurrences(scene).map((link) => link.path)).toEqual(['res://lib.tres']);
  });

  it('gives an empty list for a document with no res:// path', () => {
    expect(resPathOccurrences(new LanguageDocument('[gd_scene format=3]\n'))).toEqual([]);
  });
});
