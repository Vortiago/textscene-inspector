import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { INSTANCED_TREE, LINE, NODE_TREE_HEAD, SCENE } from './fixtures.testkit';
import { documentHighlights } from './highlights';

describe('documentHighlights', () => {
  it('marks every use of an id and its declaration', () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.meshProperty - 1]!;
    const highlights = documentHighlights(document, {
      line: LINE.meshProperty - 1,
      character: text.indexOf('SubResource') + 3,
    });
    expect(highlights).toHaveLength(2);
    // One on the declaration heading and one on the use.
    expect(highlights.map((highlight) => highlight.range.start.line).sort((a, b) => a - b)).toEqual([
      LINE.subMesh - 1,
      LINE.meshProperty - 1,
    ]);
  });

  it('marks both uses of a referenced id', () => {
    const text = [
      '[node name="A" type="MeshInstance3D"]',
      'mesh = ExtResource("1")',
      '',
      '[node name="B" type="MeshInstance3D"]',
      'mesh = ExtResource("1")',
    ].join('\n');
    const document = new LanguageDocument(text);
    const highlights = documentHighlights(document, { line: 1, character: 10 });
    expect(highlights).toHaveLength(2);
  });

  it('skips a reference spelled inside a string, which the loader never resolves', () => {
    const text = [
      '[node name="A" type="Label"]',
      'text = "see',
      'ExtResource(1)"',
      'tooltip_text = ExtResource(1)',
    ].join('\n');
    const document = new LanguageDocument(text);
    const highlights = documentHighlights(document, { line: 3, character: 20 });
    expect(highlights.map((highlight) => highlight.range.start.line)).toEqual([3]);
  });

  it('marks an old-style integer id and its declaration, as the loader resolves it', () => {
    const text = [
      '[ext_resource type="Texture2D" path="res://a.png" id=1]',
      '',
      '[node name="A" type="Sprite2D"]',
      'texture = ExtResource(1)',
    ].join('\n');
    const document = new LanguageDocument(text);
    const highlights = documentHighlights(document, { line: 3, character: 12 });
    expect(highlights.map((highlight) => highlight.range.start.line).sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it('marks a connection end that only its uid path recovers, as a use of the node it lands on', () => {
    const text = [
      '[node name="Root" type="Node3D" unique_id=1]',
      '[node name="Button" type="Node3D" parent="." unique_id=7]',
      '[connection signal="ready" from="Gone" to="." method="_on_ready" from_uid_path=PackedInt32Array(7)]',
    ].join('\n');
    const highlights = documentHighlights(new LanguageDocument(text), { line: 1, character: 12 });
    expect(highlights.map(({ range }) => range.start.line)).toEqual([1, 2]);
  });

  it('highlights nothing away from a reference', () => {
    const document = new LanguageDocument(SCENE);
    expect(documentHighlights(document, { line: 1, character: 0 })).toEqual([]);
  });
});

describe('documentHighlights of a node path', () => {
  const text = [
    ...NODE_TREE_HEAD,
    '[connection signal="a" from="Player" to="." method="_a"]',
    '[connection signal="b" from="./Player/Sprite" to="Player" method="_b"]',
  ].join('\n');
  const document = new LanguageDocument(text);
  const column = (line: number, needle: string): number => document.lines[line]!.indexOf(needle);
  const spans = (line: number, needle: string): number[][] =>
    documentHighlights(document, { line, character: column(line, needle) + 1 })
      .map(({ range }) => [range.start.line, range.start.character, range.end.line, range.end.character])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  /** The span of the quoted value that follows `prefix` on a line. */
  const valueSpan = (line: number, prefix: string): number[] => {
    const start = column(line, prefix) + prefix.length;
    return [line, start, line, document.lines[line]!.indexOf('"', start)];
  };

  const playerUses = [
    valueSpan(4, 'name="'),
    valueSpan(6, 'parent="'),
    valueSpan(10, 'from="'),
    valueSpan(11, 'to="'),
  ];

  it('marks the name= and every path that resolves to the node, from its name=', () => {
    expect(spans(4, 'Player')).toEqual(playerUses);
  });

  it('marks the same spans from a connection end', () => {
    expect(spans(10, 'Player" to')).toEqual(playerUses);
  });

  it('leaves out a child parent= that runs through the node', () => {
    const lines = spans(4, 'Player').map(([line]) => line);
    expect(lines).not.toContain(8);
  });

  it('marks the root by its name= and every . that names it', () => {
    expect(spans(2, 'Root').map(([line]) => line)).toEqual([2, 4, 10]);
  });

  it('gives nothing for a path no heading declares', () => {
    const missing = new LanguageDocument(
      '[node name="A"]\n\n[connection signal="a" from="B" to="A" method="m"]'
    );
    expect(documentHighlights(missing, { line: 2, character: 28 })).toEqual([]);
  });
});

describe('documentHighlights of a node under an instanced scene', () => {
  it('marks the name= and every path that resolves to the node', () => {
    const document = new LanguageDocument(INSTANCED_TREE);
    const lines = documentHighlights(document, { line: 6, character: document.lines[6]!.indexOf('X') + 1 })
      .map(({ range }) => range.start.line)
      .sort((a, b) => a - b);

    expect(lines).toEqual([6, 8, 10]);
  });
});
