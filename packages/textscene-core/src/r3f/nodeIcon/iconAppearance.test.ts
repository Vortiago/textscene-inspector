/**
 * The colour and opacity of a node icon's material. Godot multiplies the material albedo by the
 * vertex colour, both converted from sRGB (`node_3d_editor_gizmos.cpp:949-962`), so each expectation
 * is one product of two sRGB-to-linear channels. The linear values are worked by hand from the sRGB
 * curve: 0.6 gives 0.3185468, 0.7 gives 0.4479884, 0.42 gives 0.147319, 0.5 gives 0.2140411.
 */

import { describe, expect, it } from 'vitest';
import { iconAppearance } from './iconAppearance';

describe('iconAppearance', () => {
  it('draws a selected icon in its own colours', () => {
    const { color, opacity } = iconAppearance('selected', false);
    expect([color.r, color.g, color.b, opacity]).toEqual([1, 1, 1, 1]);
  });

  it('multiplies an unselected icon albedo by 0.6 before the sRGB conversion', () => {
    const { color, opacity } = iconAppearance('unselected', false);
    expect(color.toArray()).toEqual([0.3185468, 0.3185468, 0.3185468].map((c) => expect.closeTo(c, 6)));
    expect(opacity).toBe(1);
  });

  it('multiplies the light tint into a selected icon', () => {
    const { color } = iconAppearance('selected', false, { r: 1, g: 0.5, b: 0.5, a: 1 });
    expect(color.toArray()).toEqual([1, 0.2140411, 0.2140411].map((c) => expect.closeTo(c, 6)));
  });

  it('multiplies the light tint into an unselected icon after the dimming', () => {
    const { color } = iconAppearance('unselected', false, { r: 1, g: 0.5, b: 0.5, a: 1 });
    expect(color.toArray()).toEqual([0.3185468, 0.0681821, 0.0681821].map((c) => expect.closeTo(c, 6)));
  });

  it('draws a selected icon of a node the edited scene does not own in the instantiated grey', () => {
    const { color, opacity } = iconAppearance('selected', true);
    expect(color.toArray()).toEqual([0.4479884, 0.4479884, 0.4479884].map((c) => expect.closeTo(c, 6)));
    expect(opacity).toBe(0.6);
  });

  it('dims the instantiated grey of an unselected icon and leaves its alpha', () => {
    const { color, opacity } = iconAppearance('unselected', true);
    expect(color.toArray()).toEqual([0.147319, 0.147319, 0.147319].map((c) => expect.closeTo(c, 6)));
    expect(opacity).toBe(0.6);
  });

  it('multiplies the modulate alpha into the opacity', () => {
    expect(iconAppearance('selected', false, { r: 1, g: 1, b: 1, a: 0.25 }).opacity).toBe(0.25);
  });
});
