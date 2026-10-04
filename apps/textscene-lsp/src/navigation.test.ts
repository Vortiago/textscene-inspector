/** Tests for resource-id and res:// navigation targets. */

import { describe, it, expect } from 'vitest';
import { createLanguageDocument } from '@textscene/core/languageFeatures';
import { resourceIdLocation, resourceLinks, resPathAt } from './navigation';

const SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]

[sub_resource type="Animation" id="Anim_1"]

[node name="Root" type="Node3D"]
texture = ExtResource("1_abc")
anim = SubResource("Anim_1")
paths = ["res://a.png", "res://b.png"]
`;

const document = createLanguageDocument(SCENE);

describe('resourceIdLocation', () => {
  it('resolves an ExtResource reference to its declaration heading', () => {
    const location = resourceIdLocation(document, { line: 7, character: 15 }, 'file:///s.tscn');

    expect(location).toEqual({
      uri: 'file:///s.tscn',
      range: {
        start: { line: 2, character: 0 },
        end: {
          line: 2,
          character: '[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]'
            .length,
        },
      },
    });
  });

  it('resolves a SubResource reference to its declaration heading', () => {
    const location = resourceIdLocation(document, { line: 8, character: 10 }, 'file:///s.tscn');

    expect(location?.range.start.line).toBe(4);
  });

  it('gives nothing off every reference', () => {
    expect(resourceIdLocation(document, { line: 9, character: 0 }, 'file:///s.tscn')).toBeUndefined();
  });

  it('gives nothing for a reference whose declaration is absent', () => {
    const dangling = createLanguageDocument('texture = ExtResource("missing")\n');

    expect(resourceIdLocation(dangling, { line: 0, character: 12 }, 'file:///s.tscn')).toBeUndefined();
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

describe('resourceLinks', () => {
  it('finds every res:// occurrence, two on one line included', () => {
    const links = resourceLinks(document);

    expect(links.map((link) => link.path)).toEqual(['res://icon.png', 'res://a.png', 'res://b.png']);
    expect(links[1]!.range.start.line).toBe(9);
    expect(links[1]!.range.end.character).toBeGreaterThan(links[1]!.range.start.character);
  });

  it('gives an empty list for a document with no res:// path', () => {
    expect(resourceLinks(createLanguageDocument('[gd_scene format=3]\n'))).toEqual([]);
  });
});
