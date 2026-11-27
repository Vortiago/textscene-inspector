import { describe, expect, it } from 'vitest';
import { completionsAt } from './completion';
import { LanguageDocument } from './document';
import { hoverAt } from './hover';

const HEADING = '[node name="B" type="Node3D" parent="."]';

/** Node2D's body line holds a property, then a heading that opens B, as Godot reads it. */
const TEXT = `[node name="Root" type="Node2D"]\ntexture_filter = 1 ${HEADING}\n`;

const LINE = 1;

describe('a property before a heading on its line', () => {
  const document = new LanguageDocument(TEXT);

  it('places the property outside the heading', () => {
    expect(document.isInHeading(LINE + 1, 2)).toBe(false);
  });

  it('reads the property in the section before the heading', () => {
    expect(document.sectionAt(LINE + 1, 2)?.ownerType).toBe('Node2D');
  });

  it('hovers the key', () => {
    expect(hoverAt(document, { line: LINE, character: 2 })?.range).toEqual({
      start: { line: LINE, character: 0 },
      end: { line: LINE, character: 'texture_filter'.length },
    });
  });

  it('ends the value hover at the value, before the heading', () => {
    const valueAt = 'texture_filter = '.length;
    expect(hoverAt(document, { line: LINE, character: valueAt })?.range?.end).toEqual({
      line: LINE,
      character: valueAt + 1,
    });
  });

  it('hovers the key when a property of the heading follows on the line', () => {
    const shared = new LanguageDocument(TEXT.replace(HEADING, `${HEADING} position = Vector3(1, 2, 3)`));
    expect(hoverAt(shared, { line: LINE, character: 2 })?.range?.end.character).toBe('texture_filter'.length);
  });

  it('completes the key as it does with no heading after it', async () => {
    const alone = new LanguageDocument(TEXT.replace(` ${HEADING}`, ''));
    const labels = async (from: LanguageDocument) =>
      (await completionsAt(from, { line: LINE, character: 3 })).map(({ label }) => label);
    expect(await labels(document)).toEqual(await labels(alone));
  });
});
