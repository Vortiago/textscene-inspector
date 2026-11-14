/**
 * The design and normalised coordinates of Cascadia Code's `wght` axis (200 to 700, default 400, `avar` v1).
 * The normalised values are the 16.16 ones fontTools' `normalizeValue` and the `avar` segments give.
 */

import { describe, expect, it } from 'vitest';
import { fixtureSfnt } from '../sfntOutlines.testkit';
import { designCoordinates, normalizedCoordinates } from './axisCoordinates';
import { readAvar } from './avar';
import { fvarAxesOf } from './fvar';

const WGHT = 2003265652;
const sfnt = fixtureSfnt('cascadia-code-subset.ttf');
const axes = fvarAxesOf(sfnt)!;
const avar = readAvar(sfnt, axes.length);

const normalizedAt = (weight: number): number =>
  normalizedCoordinates(axes, designCoordinates(axes, new Map([[WGHT, weight]])), avar)[0]!;

describe('designCoordinates', () => {
  it('is the default of every axis for an empty dictionary', () => {
    expect(designCoordinates(axes, new Map())).toEqual([400 * 0x10000]);
  });

  it('clamps a value to the axis range (text_server_adv.cpp:1930-1938)', () => {
    expect(designCoordinates(axes, new Map([[WGHT, 9000]]))).toEqual([700 * 0x10000]);
    expect(designCoordinates(axes, new Map([[WGHT, -5]]))).toEqual([200 * 0x10000]);
  });

  it('lets the name win over the tag, as Godot reads the name last', () => {
    expect(
      designCoordinates(
        axes,
        new Map<number | string, number>([
          [WGHT, 300],
          ['weight', 600],
        ])
      )
    ).toEqual([600 * 0x10000]);
  });

  it('rounds the value to a float and truncates the 16.16 result', () => {
    expect(designCoordinates(axes, new Map([[WGHT, 400.1]]))).toEqual([
      Math.trunc(Math.fround(400.1) * 0x10000),
    ]);
  });

  it('ignores a key the font has no axis for', () => {
    expect(designCoordinates(axes, new Map([['custom_ZZZZ', 5]]))).toEqual([400 * 0x10000]);
  });
});

describe('normalizedCoordinates', () => {
  it.each([
    [200, -65536],
    [300, -43692],
    [400, 0],
    [600, 39319],
    [700, 65536],
  ])('maps wght %d through avar to %d in 16.16', (weight, expected) => {
    expect(normalizedAt(weight)).toBe(expected);
  });
});
