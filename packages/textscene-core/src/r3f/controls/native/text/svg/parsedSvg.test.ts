import { describe, expect, it } from 'vitest';
import { parsedSvg } from './parsedSvg';

const SVG = 'xmlns="http://www.w3.org/2000/svg"';

describe('parsedSvg', () => {
  it('parses a well-formed document', () => {
    expect(parsedSvg(`<svg ${SVG}><rect width="2"/></svg>`)?.firstElementChild?.getAttribute('width')).toBe(
      '2'
    );
  });

  it('parses a document whose text and attributes Godot wrote unescaped', () => {
    const svg = parsedSvg(`<svg ${SVG}><text font-family="a<b">1 & 2</text></svg>`);
    expect([svg?.firstElementChild?.getAttribute('font-family'), svg?.textContent]).toEqual(['a<b', '1 & 2']);
  });

  it('gives nothing for a document with no svg element', () => {
    expect(parsedSvg('<g/>')).toBeNull();
  });
});
