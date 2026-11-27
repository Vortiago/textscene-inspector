import { describe, expect, it } from 'vitest';
import { codeActions } from './codeActions';
import { LanguageDocument } from './document';
import { documentSymbols } from './symbols';
import type { DocumentSymbol, Range } from './types';

const ROOT = '[node name="Root" type="Node"]';
const A = '[node name="A" type="Node" parent="."]';
const B = '[node name="B" type="Node" parent="."]';
const C = '[node name="C" type="Node" parent="."]';

/** Each case puts two or three headings on its second line, after `lead`. */
const CASES = [
  { name: 'two headings', lead: '', shared: [A, B], after: [] },
  { name: 'two headings after an indent', lead: '  ', shared: [A, B], after: [] },
  { name: 'three headings', lead: '', shared: [A, B, C], after: [] },
  { name: 'two headings, then a body line', lead: '', shared: [A, B], after: ['visible = false'] },
  { name: 'two headings, then a heading', lead: '', shared: [A, B], after: [C] },
];

function documentOf({ lead, shared, after }: (typeof CASES)[number]): LanguageDocument {
  return new LanguageDocument([ROOT, lead + shared.join(' '), ...after, ''].join('\n'));
}

function contains(outer: Range, inner: Range): boolean {
  const before = (a: Range['start'], b: Range['start']) =>
    a.line < b.line || (a.line === b.line && a.character <= b.character);
  return before(outer.start, inner.start) && before(inner.end, outer.end);
}

function flatten(symbols: readonly DocumentSymbol[]): DocumentSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);
}

describe.each(CASES)('headings that share a line: $name', (scene) => {
  it('ends every section on or after its own heading line', () => {
    for (const section of documentOf(scene).sections) {
      expect(section.endLine).toBeGreaterThanOrEqual(section.headingLine);
    }
  });

  it('picks the heading a column falls in, and the first one before them all', () => {
    const document = documentOf(scene);
    const onLine = document.sections.filter((section) => section.headingLine === 2);
    expect(document.sectionAt(2, 0)).toBe(onLine[0]);
    for (const section of onLine) {
      expect(document.sectionAt(2, section.headingColumns.start)).toBe(section);
    }
  });

  it('keeps each outline symbol inside its own range', () => {
    for (const symbol of flatten(documentSymbols(documentOf(scene)))) {
      expect(contains(symbol.range, symbol.selectionRange), symbol.name).toBe(true);
    }
  });

  it('offers the class fix on the first heading of the line', () => {
    const typo = { ...scene, shared: [A.replace('type="Node"', 'type="Nde"'), ...scene.shared.slice(1)] };
    const document = documentOf(typo);
    const line = { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } };
    expect(codeActions(document, line).map((action) => action.title)).toContain("Change 'Nde' to 'Node'");
  });
});
