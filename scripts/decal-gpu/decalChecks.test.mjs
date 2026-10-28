import { describe, expect, it } from 'vitest';
import { decalFailures, dimsPixel, matchesPixel, showsDecal, showsNoDecal } from './decalChecks.mjs';

const GREY = [0.2, 0.2, 0.2];
const RED = [0.6, 0, 0];
const GREEN = [0, 0.6, 0];

const bare = (pixel = GREY) => ({ drawn: pixel, bare: GREY });
const takesDecal = (colour = RED) => ({ drawn: colour, bare: GREY });
const dimmed = () => bare([0.05, 0.05, 0.05]);
/** A receiver whose pixel inside the box is `inside` and whose pixel outside it is the shading alone. */
const withInside = (inside) => ({ inside, outside: bare() });

/** The samples of a renderer that draws every scene as Godot does. */
function passingSamples() {
  const receiver = { inside: takesDecal(), outside: bare() };
  return {
    lit: receiver,
    physical: receiver,
    unshaded: receiver,
    transparent: receiver,
    doubleSided: receiver,
    motion: {
      before: { oldPlace: takesDecal(), newPlace: bare() },
      after: { oldPlace: bare(), newPlace: takesDecal() },
    },
    receiverMoves: { before: bare(), after: takesDecal() },
    skinnedReceiver: { before: bare(), after: takesDecal() },
    editorChrome: { chrome: bare(), surface: takesDecal() },
    maskCleared: bare(),
    maskKept: takesDecal(),
    nearestOnTop: takesDecal(GREEN),
    sortingOffset: takesDecal(RED),
    groupsOf32: takesDecal(GREEN),
    limit: takesDecal(RED),
    emission: {
      lit: withInside(takesDecal()),
      physical: withInside(takesDecal()),
      unshaded: withInside(bare()),
      withAlbedo: withInside(takesDecal()),
      noEnergy: withInside(bare()),
    },
    normalOnly: withInside(bare()),
    ormOnly: withInside(bare()),
    normalMap: { lit: withInside(dimmed()), unshaded: withInside(bare()) },
    magnifiedNormal: { between: withInside(bare()), flat: withInside(bare()) },
    ormMap: {
      metallic: withInside(dimmed()),
      occlusion: withInside(dimmed()),
      occlusionOfAoMap: withInside(dimmed()),
      unshaded: withInside(bare()),
    },
  };
}

describe('showsDecal', () => {
  it('passes a pixel the decal colour dominates', () => {
    expect(showsDecal('floor', takesDecal(), 'red')).toBeUndefined();
  });

  it('names the check, the expected and the found colour with the pixel (error case)', () => {
    expect(showsDecal('floor', takesDecal(GREEN), 'red')).toBe(
      'floor: expected a red pixel, found green (0.000, 0.600, 0.000)'
    );
  });

  it('finds no colour in a grey pixel (edge case)', () => {
    expect(showsDecal('floor', bare(), 'red')).toContain('found none');
  });
});

describe('showsNoDecal', () => {
  it('passes a pixel the shading draws alone', () => {
    expect(showsNoDecal('floor', bare())).toBeUndefined();
  });

  it('passes a pixel off by less than the tolerance (edge case)', () => {
    expect(showsNoDecal('floor', bare([0.21, 0.2, 0.19]))).toBeUndefined();
  });

  it('names the pixel expected and the pixel found (error case)', () => {
    expect(showsNoDecal('floor', takesDecal())).toBe(
      'floor: expected the pixel (0.200, 0.200, 0.200) that the shading draws alone, found (0.600, 0.000, 0.000)'
    );
  });
});

describe('dimsPixel', () => {
  it('passes a pixel well under the one the shading draws alone', () => {
    expect(dimsPixel('floor', dimmed())).toBeUndefined();
  });

  it('names the pixel expected under and the pixel found (error case)', () => {
    expect(dimsPixel('floor', bare())).toBe(
      'floor: expected a pixel dimmer than (0.200, 0.200, 0.200), found (0.200, 0.200, 0.200)'
    );
  });

  it('fails a pixel that dims by less than a third (edge case)', () => {
    expect(dimsPixel('floor', bare([0.15, 0.15, 0.15]))).toContain('expected a pixel dimmer');
  });
});

describe('matchesPixel', () => {
  it('passes two pixels within the tolerance', () => {
    expect(matchesPixel('floor', bare([0.204, 0.2, 0.196]), bare())).toBeUndefined();
  });

  it('fails two pixels 5 bytes apart (edge case)', () => {
    expect(matchesPixel('floor', bare([0.22, 0.2, 0.2]), bare())).toContain('expected the pixel');
  });

  it('names both pixels (error case)', () => {
    expect(matchesPixel('floor', dimmed(), bare())).toBe(
      'floor: expected the pixel (0.200, 0.200, 0.200), found (0.050, 0.050, 0.050)'
    );
  });
});

describe('decalFailures', () => {
  it('passes the samples of a renderer that draws every scene as Godot does', () => {
    expect(decalFailures(passingSamples())).toEqual([]);
  });

  it('names a decal that a skinned receiver does not take', () => {
    const samples = { ...passingSamples(), skinnedReceiver: { before: bare(), after: bare() } };

    expect(decalFailures(samples)).toEqual([expect.stringContaining('a skinned receiver that a bone moved')]);
  });

  it('names the 33rd decal that a nearest-last order puts under the rest', () => {
    const samples = { ...passingSamples(), groupsOf32: takesDecal(RED) };

    expect(decalFailures(samples)).toEqual([expect.stringContaining('the 33rd decal')]);
  });

  it('names an emission-only decal that draws nothing', () => {
    const samples = {
      ...passingSamples(),
      emission: { ...passingSamples().emission, lit: withInside(bare()) },
    };

    expect(decalFailures(samples)).toEqual([expect.stringContaining('emission on a lit receiver')]);
  });

  it('names a normal map that a decal with no albedo applies', () => {
    const samples = { ...passingSamples(), normalOnly: withInside(dimmed()) };

    expect(decalFailures(samples)).toEqual([expect.stringContaining('a normal map with no albedo')]);
  });

  it('names an ORM map that leaves a receiver with an AO map as it was', () => {
    const ormMap = { ...passingSamples().ormMap, occlusionOfAoMap: withInside(bare()) };

    expect(decalFailures({ ...passingSamples(), ormMap })).toEqual([
      expect.stringContaining('an ORM map that occludes a receiver with an AO map'),
    ]);
  });

  it('names a magnified normal map that filters its texels as decoded values, not as bytes', () => {
    const magnifiedNormal = { between: withInside(dimmed()), flat: withInside(bare()) };

    expect(decalFailures({ ...passingSamples(), magnifiedNormal })).toEqual([
      expect.stringContaining('a magnified normal map between two texels'),
    ]);
  });

  it('names the editor chrome that takes a decal', () => {
    const samples = { ...passingSamples(), editorChrome: { chrome: takesDecal(), surface: takesDecal() } };

    expect(decalFailures(samples)).toEqual([expect.stringContaining('editor chrome in the box')]);
  });
});
