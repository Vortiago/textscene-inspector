import { describe, expect, it } from 'vitest';
import { codeActions } from '../languageFeatures/codeActions';
import { completionsAt } from '../languageFeatures/completion';
import { LanguageDocument } from '../languageFeatures/document';
import { foldingRanges } from '../languageFeatures/folding';
import { documentHighlights } from '../languageFeatures/highlights';
import { hoverAt } from '../languageFeatures/hover';
import { definitionRangeAt, resPathOccurrences } from '../languageFeatures/navigation';
import { nodePathAt } from '../languageFeatures/nodePathAt';
import { resourceReferences } from '../languageFeatures/resourceRefs';
import { documentSymbols } from '../languageFeatures/symbols';
import type { Position, Range } from '../languageFeatures/types';
import { Linter } from '../linter/Linter';
import type { SceneFile } from '../scene/sceneFiles';
import { sceneFailingReads, sceneFileReads } from '../resources/loadFailure/fileReads';
import { sceneFailureOf } from '../resources/loadFailure/sceneFailure';
import { TscnParser } from './TscnParser';

const AFTER_BRACKET = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[sub_resource type="AtlasTexture" id="a"] atlas = ExtResource("1")

[node name="Root" type="Node2D"]

[node name="S" type="Sprite2D" parent="."] visble = true
texture = SubResource("a")

[connection signal="ready" from="S" to="." method="f"]
`;

const OVER_LINES = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[sub_resource type="AtlasTexture" ; a comment
id="a"]
atlas = ExtResource("1")

[node name="Root" type="Node2D"]

[node name="S" ; a comment
type="Sprite2D" parent="."]
visble = true
texture = SubResource("a")

[connection signal="ready" from="S" to="." method="f"]
`;

const SCENE = 'res://main.tscn';
const WHOLE: Range = { start: { line: 0, character: 0 }, end: { line: 20, character: 0 } };

/** The zero-based position `offset` characters into the first `needle` of `text`. */
function at(text: string, needle: string, offset = 1): Position {
  const before = text.slice(0, text.indexOf(needle) + offset).split('\n');
  return { line: before.length - 1, character: before.at(-1)!.length };
}

function range(line: number, start: number, end: number): Range {
  return { start: { line, character: start }, end: { line, character: end } };
}

function missing(path: string): SceneFile {
  return {
    path,
    type: null,
    state: 'missing',
    owners: [SCENE],
    reason: { chain: [path], cause: 'missing', addresses: [] },
    addresses: [],
  };
}

function banner(text: string): string | undefined {
  const { failing, parseStop } = sceneFailingReads(SCENE, new TscnParser().parse(text));
  const files = failing.map((read) => missing(read.path));
  return sceneFailureOf(files, { scene: SCENE, reads: failing, parseStop })?.line;
}

/** Each spacing around a property's `=`, and how far it moves the value from `key = value`. */
const SPACINGS = [
  { spacing: 'key = value', equals: ' = ', valueShift: 0 },
  { spacing: 'key=value', equals: '=', valueShift: -2 },
  { spacing: 'key =value', equals: ' =', valueShift: -1 },
];

const SCENES = [
  {
    scene: 'a property after a heading on its line',
    text: AFTER_BRACKET,
    keyRange: range(8, 43, 49),
    typeHover: '**Sprite2D**',
    idHighlight: [range(4, 38, 39)],
    lintColumn: { line: 9, column: 53 },
    malformedColumn: { line: 9, column: 44 },
    laterValueColumn: { line: 10, column: 0 },
    typeRange: range(8, 21, 28),
    folds: [{ startLine: 8, endLine: 9 }],
    nodeSelection: range(8, 0, 42),
    extReference: range(4, 50, 66),
    bannerLine: 5,
  },
  {
    scene: 'headings over several lines with a comment inside',
    text: OVER_LINES,
    keyRange: range(12, 0, 6),
    // No hover, highlight or type fix on a heading's second line: the features read its first line only.
    typeHover: undefined,
    idHighlight: [],
    lintColumn: { line: 13, column: 10 },
    malformedColumn: { line: 13, column: 1 },
    laterValueColumn: { line: 14, column: 0 },
    typeRange: undefined,
    folds: [
      { startLine: 4, endLine: 6 },
      { startLine: 10, endLine: 13 },
    ],
    nodeSelection: range(10, 0, 14),
    extReference: range(6, 8, 24),
    bannerLine: 7,
  },
];

function shifted({ start, end }: Range, by: number): Range {
  return {
    start: { ...start, character: start.character + by },
    end: { ...end, character: end.character + by },
  };
}

const ROWS = SCENES.flatMap((scene) =>
  SPACINGS.map(({ spacing, equals, valueShift }) => ({
    ...scene,
    spacing,
    text: scene.text.replaceAll(' = ', equals),
    /** The scene with one property changed, spaced as the row is. */
    edited: (from: string, to: string) => scene.text.replace(from, to).replaceAll(' = ', equals),
    lintColumn: { ...scene.lintColumn, column: scene.lintColumn.column + valueShift },
    extReference: shifted(scene.extReference, valueShift),
  }))
);

describe.each(ROWS)('each caller of the reader, on $scene, spaced $spacing', (row) => {
  const document = new LanguageDocument(row.text);

  it('hovers the key', () => {
    expect(hoverAt(document, at(row.text, 'visble'))?.range).toEqual(row.keyRange);
  });

  it('hovers the node type', () => {
    expect(hoverAt(document, at(row.text, 'Sprite2D', 2))?.markdown.split('\n')[0]).toBe(row.typeHover);
  });

  it('completes the key', async () => {
    const labels = (await completionsAt(document, at(row.text, 'visble', 2))).map((item) => item.label);
    expect(labels).toContain('visible');
  });

  it('fixes the key typo on the key', () => {
    const [action] = codeActions(document, WHOLE);
    expect(action?.edit[0]?.range).toEqual(row.keyRange);
  });

  it('highlights the reference and the id its heading declares', () => {
    const highlights = documentHighlights(document, at(row.text, 'SubResource("a")', 14)).map((h) => h.range);
    expect(highlights.slice(1)).toEqual(row.idHighlight);
  });

  it('fixes the type typo on the type', () => {
    const typo = new LanguageDocument(row.text.replace('Sprite2D', 'Sprit2D'));
    const action = codeActions(typo, WHOLE).find((found) => found.title.includes('Sprit2D'));
    expect(action?.edit[0]?.range).toEqual(row.typeRange);
  });

  it('refuses a value on the line after its key, where the value starts', () => {
    const [diagnostic] = new Linter().lint(row.edited('visble = true', 'hframes =\n"x"'));
    expect(diagnostic?.location).toEqual(row.laterValueColumn);
  });

  it('places a malformed property past the heading', () => {
    const [diagnostic] = new Linter().lint(row.edited('visble = true', 'garbage'));
    expect(diagnostic?.location).toEqual(row.malformedColumn);
  });

  it('places a refused value past the heading', () => {
    const [diagnostic] = new Linter().lint(row.edited('visble = true', 'hframes = "x"'));
    expect(diagnostic?.location).toEqual(row.lintColumn);
  });

  it('folds each section from its heading', () => {
    expect(foldingRanges(document)).toEqual(row.folds);
  });

  it('selects the node heading alone in the outline', () => {
    const [root] = documentSymbols(document);
    expect(root?.children[0]?.selectionRange).toEqual(row.nodeSelection);
  });

  it('names the node a body line belongs to', () => {
    expect(nodePathAt(document, at(row.text, 'texture'))).toBe('S');
  });

  it('goes to the declaration of a reference', () => {
    expect(definitionRangeAt(document, at(row.text, 'ExtResource("1")', 14))?.start.line).toBe(2);
  });

  it('finds the reference in the field after the heading', () => {
    expect(resourceReferences(document)[0]?.range).toEqual(row.extReference);
  });

  it('finds the res:// path', () => {
    expect(resPathOccurrences(document).map((found) => found.range)).toEqual([range(2, 37, 51)]);
  });

  it('lists the file in Load Errors', () => {
    expect(sceneFileReads(SCENE, new TscnParser().parse(row.text))).toEqual([
      { path: 'res://gone.png', type: 'Texture2D' },
    ]);
  });

  // Godot 4.6.3 prints these lines, measured with scripts/godot-load-oracle/loadOracle.mjs.
  it("gives the banner Godot's line", () => {
    expect(banner(row.text)).toBe(
      `${SCENE}:${row.bannerLine} - Parse Error: [ext_resource] referenced non-existent resource at: res://gone.png.`
    );
  });

  it('builds the tree with the body after the heading', () => {
    const [root] = new TscnParser().parse(row.text).nodes;
    expect(root?.children.map((child) => [child.name, 'texture' in child.properties])).toEqual([['S', true]]);
  });
});
