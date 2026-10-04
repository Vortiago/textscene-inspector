import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { LINE, SCENE } from './fixtures.testkit';
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

  it('highlights nothing away from a reference', () => {
    const document = new LanguageDocument(SCENE);
    expect(documentHighlights(document, { line: 1, character: 0 })).toEqual([]);
  });
});
