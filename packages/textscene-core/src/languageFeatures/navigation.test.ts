/** Navigation targets: a resource id's declaration heading and every res:// path. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { INSTANCED_TREE, NODE_TREE_HEAD } from './fixtures.testkit';
import { definitionRangeAt, nodeDeclarationRange, resPathAt, resPathOccurrences } from './navigation';

const SCENE = `[gd_scene format=3]

[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]

[sub_resource type="Animation" id="Anim_1"]

[node name="Root" type="Node3D"]
texture = ExtResource("1_abc")
anim = SubResource("Anim_1")
paths = ["res://a.png", "res://b.png"]
`;

const document = new LanguageDocument(SCENE);

describe('definitionRangeAt of a resource id', () => {
  it('resolves an ExtResource reference to its declaration heading', () => {
    expect(definitionRangeAt(document, { line: 7, character: 15 })).toEqual({
      start: { line: 2, character: 0 },
      end: {
        line: 2,
        character: '[ext_resource type="Texture2D" uid="uid://abc" path="res://icon.png" id="1_abc"]'.length,
      },
    });
  });

  it('resolves a SubResource reference to its declaration heading', () => {
    expect(definitionRangeAt(document, { line: 8, character: 10 })?.start.line).toBe(4);
  });

  it("resolves a declaration's own id= to its heading", () => {
    const line = document.lines[4]!;
    expect(definitionRangeAt(document, { line: 4, character: line.indexOf('Anim_1') + 1 })?.start.line).toBe(
      4
    );
  });

  it('gives nothing off every reference', () => {
    expect(definitionRangeAt(document, { line: 9, character: 0 })).toBeUndefined();
  });

  it('gives nothing for a reference whose declaration is absent', () => {
    const dangling = new LanguageDocument('texture = ExtResource("missing")\n');

    expect(definitionRangeAt(dangling, { line: 0, character: 12 })).toBeUndefined();
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

describe('definitionRangeAt of a node path', () => {
  const SCENE_PATHS = [
    ...NODE_TREE_HEAD,
    '[node name="Door" type="Node3D" parent="." instance=ExtResource("1_door")]',
    '',
    '[node name="Hinge" type="Node3D" parent="Door"]',
    '',
    '[node name="Unique" type="Node3D" parent="Player"]',
    'unique_name_in_owner = true',
    '',
    '[connection signal="pressed" from="Player/Sprite" to="." method="_on_pressed"]',
    '[connection signal="pressed" from="./Player" to="Player/../Player/Sprite" method="_a"]',
    '[connection signal="pressed" from="Door/Inside/Deep" to="Missing" method="_b"]',
    '[connection signal="pressed" from="%Unique" to="Player/%Unique" method="_c"]',
    '',
  ].join('\n');
  const paths = new LanguageDocument(SCENE_PATHS);

  function headingLineAt(lineText: string, value: string): number | undefined {
    const line = paths.lines.findIndex((candidate) => candidate.startsWith(lineText));
    const position = { line, character: paths.lines[line]!.indexOf(value) + 1 };
    return definitionRangeAt(paths, position)?.start.line;
  }

  it('resolves a from= path to the heading of the node it names', () => {
    expect(headingLineAt('[connection signal="pressed" from="Player/Sprite"', 'Player/Sprite')).toBe(6);
  });

  it('resolves a to= of . to the root heading', () => {
    expect(headingLineAt('[connection signal="pressed" from="Player/Sprite"', '"." method')).toBe(2);
  });

  it('resolves a parent= three levels deep', () => {
    expect(headingLineAt('[node name="Gun"', 'Player/Sprite')).toBe(6);
  });

  it('resolves a parent= of . to the root heading', () => {
    expect(headingLineAt('[node name="Player"', '"."]')).toBe(2);
  });

  it('reads ./A and A/../A like A', () => {
    expect(headingLineAt('[connection signal="pressed" from="./Player"', './Player')).toBe(4);
    expect(headingLineAt('[connection signal="pressed" from="./Player"', 'Player/../Player/Sprite')).toBe(6);
  });

  it('resolves a %Unique path to the node that claims the name', () => {
    expect(headingLineAt('[connection signal="pressed" from="%Unique"', '%Unique" to')).toBe(14);
    expect(headingLineAt('[connection signal="pressed" from="%Unique"', 'Player/%Unique')).toBe(14);
  });

  it('gives nothing for a path into an instanced scene', () => {
    expect(headingLineAt('[connection signal="pressed" from="Door/Inside/Deep"', 'Door/Inside/Deep')).toBe(
      undefined
    );
  });

  it('gives nothing for a path no heading declares', () => {
    expect(headingLineAt('[connection signal="pressed" from="Door/Inside/Deep"', 'Missing')).toBe(undefined);
  });

  it('gives nothing off a node path value', () => {
    expect(headingLineAt('[connection signal="pressed" from="Player/Sprite"', 'method')).toBe(undefined);
  });
});

describe('definitionRangeAt of a node path on a heading tag named like an Object property', () => {
  it('gives nothing for a constructor heading', () => {
    const odd = new LanguageDocument('[constructor name="A"]\n');
    expect(definitionRangeAt(odd, { line: 0, character: 5 })).toBeUndefined();
  });
});

describe('definitionRangeAt of a node path under a %Name parent', () => {
  const UNIQUE = [
    '[node name="Root" type="Node3D"]',
    '[node name="Player" type="Node3D" parent="."]',
    'unique_name_in_owner = true',
    '[node name="Hand" type="Node3D" parent="%Player"]',
    '[node name="Mesh" type="Node3D" parent="Player/Hand"]',
  ].join('\n');

  it('resolves the path of a node seated under a claimed name', () => {
    const unique = new LanguageDocument(UNIQUE);
    const character = unique.lines[4]!.indexOf('Player/Hand') + 1;

    expect(definitionRangeAt(unique, { line: 4, character })?.start.line).toBe(3);
  });
});

describe('definitionRangeAt of a node path under an instanced scene', () => {
  const instanced = new LanguageDocument(INSTANCED_TREE);
  const definitionLine = (line: number, value: string): number | undefined =>
    definitionRangeAt(instanced, { line, character: instanced.lines[line]!.indexOf(value) + 1 })?.start.line;

  it('resolves a parent= to the heading seated under the instance', () => {
    expect(definitionLine(8, 'Inst/Sub/X')).toBe(6);
  });

  it('resolves a to= to the heading seated under the instance', () => {
    expect(definitionLine(10, 'Inst/Sub/X')).toBe(6);
  });

  it('gives nothing for a path into the instanced scene that no heading declares', () => {
    expect(definitionLine(6, 'Inst/Sub')).toBe(undefined);
  });
});

describe('definitionRangeAt of a node path that Godot seats differently from its spelling', () => {
  /** The heading line that the path `value` on the last line resolves to. */
  function definitionLine(lines: readonly string[], value: string): number | undefined {
    const document = new LanguageDocument(lines.join('\n'));
    const line = lines.length - 1;
    const character = lines[line]!.lastIndexOf(`"${value}"`) + 1;
    return definitionRangeAt(document, { line, character })?.start.line;
  }

  it('resolves a path to the later of two siblings sharing a name', () => {
    // `_add_child_nocheck` inserts the later node over the earlier in the child lookup (node.cpp:1656).
    const lines = [
      '[node name="Root" type="Node3D"]',
      '[node name="A" type="Node3D" parent="."]',
      '[node name="A" type="Node2D" parent="."]',
      '[node name="B" type="Node3D" parent="A"]',
    ];
    expect(definitionLine(lines, 'A')).toBe(2);
  });

  it('resolves . to heading 0 when every heading declares a parent', () => {
    // Heading 0 is the root (packed_scene.cpp:218-219).
    const lines = ['[node name="Root" type="Node3D" parent="."]', '[node name="A" type="Node3D" parent="."]'];
    expect(definitionLine(lines, '.')).toBe(0);
  });

  it('resolves a connection path that walks only once simplified', () => {
    // The loader stores `from.simplified()` (resource_format_text.cpp:370), so `Gone` is never looked up.
    const lines = [
      '[node name="Root" type="Node3D"]',
      '[node name="Button" type="Node3D" parent="."]',
      '[connection signal="ready" from="Gone/../Button" to="." method="_on_ready"]',
    ];
    expect(definitionLine(lines, 'Gone/../Button')).toBe(1);
  });

  it('resolves a connection end that only its uid path recovers', () => {
    // A path that misses falls back to the id trail (packed_scene.cpp:161-163, :657-658).
    const lines = [
      '[node name="Root" type="Node3D" unique_id=1]',
      '[node name="Button" type="Node3D" parent="." unique_id=7]',
      '[connection signal="ready" from="Gone" to="." method="_on_ready" from_uid_path=PackedInt32Array(7)]',
    ];
    expect(definitionLine(lines, 'Gone')).toBe(1);
  });

  it('resolves a to= that only its to_uid_path recovers', () => {
    const lines = [
      '[node name="Root" type="Node3D" unique_id=1]',
      '[node name="Button" type="Node3D" parent="." unique_id=7]',
      '[connection signal="ready" from="." to="Gone" method="_on_ready" to_uid_path=PackedInt32Array(7)]',
    ];
    expect(definitionLine(lines, 'Gone')).toBe(1);
  });

  it('gives nothing for a connection end whose uid path names no heading', () => {
    const lines = [
      '[node name="Root" type="Node3D" unique_id=1]',
      '[node name="Button" type="Node3D" parent="." unique_id=7]',
      '[connection signal="ready" from="Gone" to="." method="_on_ready" from_uid_path=PackedInt32Array(99)]',
    ];
    expect(definitionLine(lines, 'Gone')).toBe(undefined);
  });

  it('gives nothing for a parent= that walks only once simplified, which the loader never simplifies', () => {
    const lines = [
      '[node name="Root" type="Node3D"]',
      '[node name="Button" type="Node3D" parent="."]',
      '[node name="Child" type="Node3D" parent="Gone/../Button"]',
    ];
    expect(definitionLine(lines, 'Gone/../Button')).toBe(undefined);
  });
});

describe('nodeDeclarationRange', () => {
  const tree = new LanguageDocument(NODE_TREE_HEAD.join('\n'));

  it('gives the heading line of the node a path names', () => {
    expect(nodeDeclarationRange(tree, 'Player/Sprite')?.start.line).toBe(6);
  });

  it('gives the root heading for .', () => {
    expect(nodeDeclarationRange(tree, '.')?.start.line).toBe(2);
  });

  it('gives nothing for a path no heading declares', () => {
    expect(nodeDeclarationRange(tree, 'Player/Missing')).toBeUndefined();
  });
});

describe('definitionRangeAt of a node path to a re-rooted node', () => {
  const REROOTED = [
    '[node name="Root" type="Node3D"]',
    '[node name="Orphan" type="Node3D" parent="Gone"]',
    '[node name="Kid" type="Node3D" parent="Gone#Orphan"]',
    '[connection signal="s" from="Gone#Orphan" to="." method="m"]',
    '[connection signal="s" from="Orphan" to="." method="m"]',
  ];

  /** The line of the heading the path in `lines[line]` names, or undefined. */
  function headingLineOfPath(lines: string[], line: number, value: string): number | undefined {
    const scene = new LanguageDocument(lines.join('\n'));
    const character = scene.lines[line]!.indexOf(value) + 1;
    return definitionRangeAt(scene, { line, character })?.start.line;
  }

  it('resolves a from= spelling the rename to the re-rooted heading', () => {
    expect(headingLineOfPath(REROOTED, 3, 'Gone#Orphan')).toBe(1);
  });

  it('resolves a parent= below the re-rooted node to its heading', () => {
    expect(headingLineOfPath(REROOTED, 2, 'Gone#Orphan')).toBe(1);
  });

  it('gives nothing for the authored name, which Godot no longer finds (edge case)', () => {
    expect(headingLineOfPath(REROOTED, 4, '"Orphan"')).toBeUndefined();
  });

  it('gives nothing where a later heading declares no parent, so Godot re-roots nothing (edge case)', () => {
    const refused = [...REROOTED.slice(0, 2), '[node name="Stray" type="Node3D"]', ...REROOTED.slice(2)];
    expect(headingLineOfPath(refused, 4, 'Gone#Orphan')).toBeUndefined();
  });

  it('resolves the rename where a parent_id_path names no node, so Godot re-roots it (edge case)', () => {
    // The trail lookup misses, so `nparent` stays null and the re-root runs (packed_scene.cpp:161-163, :208-215).
    const trailed = [...REROOTED];
    trailed[1] = '[node name="Orphan" type="Node3D" parent="Gone" parent_id_path=PackedInt32Array(7)]';
    expect(headingLineOfPath(trailed, 3, 'Gone#Orphan')).toBe(1);
  });

  it('gives nothing for the rename where the parent_id_path lands, so Godot seats the node there', () => {
    const trailed = [...REROOTED];
    trailed[0] = '[node name="Root" type="Node3D" unique_id=7]';
    trailed[1] = '[node name="Orphan" type="Node3D" parent="Gone" parent_id_path=PackedInt32Array(7)]';
    expect(headingLineOfPath(trailed, 3, 'Gone#Orphan')).toBeUndefined();
  });
});
