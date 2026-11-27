import { describe, expect, it } from 'vitest';
import { codeActions } from './codeActions';
import { completionsAt } from './completion';
import { LanguageDocument } from './document';
import { foldingRanges } from './folding';
import { documentHighlights } from './highlights';
import { hoverAt } from './hover';
import { definitionRangeAt } from './navigation';
import { nodePathAt } from './nodePathAt';
import { referenceAt } from './resourceRefs';
import { documentSymbols } from './symbols';
import type { DocumentSymbol, Position, Range } from './types';

const ROOT = '[node name="Root" type="Node"]';

/** Each heading has its own name and class, so a feature that reads the wrong one shows. */
const HEADINGS = {
  A: { text: '[node name="A" type="Node2D" parent="."]', type: 'Node2D', path: 'A' },
  B: { text: '[node name="B" type="Node3D" parent="A"]', type: 'Node3D', path: 'A/B' },
  C: { text: '[node name="C" type="Control" parent="."]', type: 'Control', path: 'C' },
};
type HeadingName = keyof typeof HEADINGS;

/** Each case puts two or three headings on its second line, after `lead`. */
const CASES: { name: string; lead: string; shared: HeadingName[]; after: string[] }[] = [
  { name: 'two headings', lead: '', shared: ['A', 'B'], after: [] },
  { name: 'two headings after an indent', lead: '  ', shared: ['A', 'B'], after: [] },
  { name: 'three headings', lead: '', shared: ['A', 'B', 'C'], after: [] },
  { name: 'two headings, then a body line', lead: '', shared: ['A', 'B'], after: ['visible = false'] },
  { name: 'two headings, then a heading', lead: '', shared: ['A', 'B'], after: [HEADINGS.C.text] },
];

const SHARED_LINE = 1;

function sceneText({ lead, shared, after }: (typeof CASES)[number], edit = (text: string) => text): string {
  const line = lead + shared.map((name) => HEADINGS[name].text).join(' ');
  return [ROOT, edit(line), ...after, ''].join('\n');
}

/** The zero-based position `offset` characters into `needle`, inside heading `name` on the shared line. */
function inHeading(text: string, name: HeadingName, needle: string, offset = 0): Position {
  const line = text.split('\n')[SHARED_LINE]!;
  const start = line.indexOf(HEADINGS[name].text);
  return { line: SHARED_LINE, character: start + HEADINGS[name].text.indexOf(needle) + offset };
}

function contains(outer: Range, inner: Range): boolean {
  const before = (a: Position, b: Position) =>
    a.line < b.line || (a.line === b.line && a.character <= b.character);
  return before(outer.start, inner.start) && before(inner.end, outer.end);
}

function flatten(symbols: readonly DocumentSymbol[]): DocumentSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);
}

describe.each(CASES)('headings that share a line: $name', (scene) => {
  const text = sceneText(scene);
  const document = new LanguageDocument(text);

  it('ends every section on or after its own heading line', () => {
    for (const section of document.sections) {
      expect(section.endLine).toBeGreaterThanOrEqual(section.headingLine);
    }
  });

  it('picks the heading a column falls in, and the first one before them all', () => {
    const onLine = document.sections.filter((section) => section.headingLine === SHARED_LINE + 1);
    expect(document.sectionAt(SHARED_LINE + 1, 0)).toBe(onLine[0]);
    for (const section of onLine) {
      expect(document.sectionAt(SHARED_LINE + 1, section.headingColumns.start)).toBe(section);
    }
  });

  it('keeps each outline symbol inside its own range', () => {
    for (const symbol of flatten(documentSymbols(document))) {
      expect(contains(symbol.range, symbol.selectionRange), symbol.name).toBe(true);
    }
  });

  it('folds no section backwards', () => {
    for (const fold of foldingRanges(document)) expect(fold.endLine).toBeGreaterThanOrEqual(fold.startLine);
  });

  it.each(['A', 'B'] as const)('offers the class fix on heading %s', (name) => {
    const { type } = HEADINGS[name];
    const typo = new LanguageDocument(sceneText(scene, (line) => line.replace(`"${type}"`, '"Nde"')));
    const line = { start: { line: SHARED_LINE, character: 0 }, end: { line: SHARED_LINE, character: 0 } };
    const titles = codeActions(typo, line).map((action) => action.title);
    expect(titles.some((title) => title.startsWith("Change 'Nde'"))).toBe(true);
  });

  it.each(scene.shared)('hovers the class of heading %s', (name) => {
    const markdown = hoverAt(document, inHeading(text, name, 'type="', 7))?.markdown;
    expect(markdown?.split('\n')[0]).toBe(`**${HEADINGS[name].type}**`);
  });

  it.each(scene.shared)('completes a class, not a body key, in heading %s', async (name) => {
    const items = await completionsAt(document, inHeading(text, name, 'type="', 6));
    expect(items.map((item) => item.label)).toContain(HEADINGS[name].type);
  });

  it.each(scene.shared)('names the node path of heading %s', (name) => {
    expect(nodePathAt(document, inHeading(text, name, 'name="', 6))).toBe(HEADINGS[name].path);
  });

  it.each(scene.shared)('highlights the name of heading %s on its own columns', (name) => {
    const position = inHeading(text, name, 'name="', 6);
    const [own] = documentHighlights(document, position);
    expect(own?.range).toEqual({
      start: position,
      end: { line: SHARED_LINE, character: position.character + 1 },
    });
  });

  it('goes from the second heading’s parent to the first heading’s line', () => {
    expect(definitionRangeAt(document, inHeading(text, 'B', 'parent="', 8))?.start.line).toBe(SHARED_LINE);
  });
});

const RESOURCES = '[sub_resource type="Gradient" id="a"] [sub_resource type="Gradient" id="b"]';

describe.each(['', '  '])('resource headings that share a line, after %j', (lead) => {
  const text = ['[gd_scene format=3]', lead + RESOURCES, '[node name="Root" type="Node"]', ''].join('\n');
  const document = new LanguageDocument(text);

  it.each(['a', 'b'])('reads the id of heading %s on its own columns', (id) => {
    const character = text.split('\n')[1]!.indexOf(`id="${id}"`) + 4;
    expect(referenceAt(document, { line: 1, character })).toEqual({ kind: 'sub', id });
  });
});
