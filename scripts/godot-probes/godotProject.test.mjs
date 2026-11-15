import { describe, expect, it } from 'vitest';
import { probeIncludeFiles } from './godotProject.mjs';

const probe = (includes) => ({ name: 'p', source: '', includes });

describe("the include files of the probes' one project", () => {
  it("holds every probe's includes by name", () => {
    expect(probeIncludeFiles([probe({ 'a.gdshaderinc': 'A' }), probe({ 'b.gdshaderinc': 'B' })])).toEqual({
      'a.gdshaderinc': 'A',
      'b.gdshaderinc': 'B',
    });
  });

  it('keeps one file for a name two probes give the same text', () => {
    expect(probeIncludeFiles([probe({ 'a.gdshaderinc': 'A' }), probe({ 'a.gdshaderinc': 'A' })])).toEqual({
      'a.gdshaderinc': 'A',
    });
  });

  it('throws on a name two probes give two texts', () => {
    expect(() =>
      probeIncludeFiles([probe({ 'a.gdshaderinc': 'A' }), probe({ 'a.gdshaderinc': 'B' })])
    ).toThrow('expected one text for the include a.gdshaderinc, got two');
  });
});
