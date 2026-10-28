/**
 * The tint of a light's editor icon: the light colour at full HSV value
 * (`light_3d_gizmo_plugin.cpp:150-155`). Each expectation is worked by hand from the HSV model:
 * the brightest channel becomes 1 and the saturation stays.
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import { lightIconModulate } from './iconModulate';

function light(lightColor: string): TscnNode {
  return { properties: { light_color: lightColor } } as unknown as TscnNode;
}

describe('lightIconModulate', () => {
  it('keeps a fully saturated colour', () => {
    expect(lightIconModulate(light('Color(1, 0, 0, 1)'))).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('brightens a dim colour to full value and keeps its saturation', () => {
    // Hue 0, saturation 0.5: value 1 gives (1, 0.5, 0.5).
    expect(lightIconModulate(light('Color(0.5, 0.25, 0.25, 1)'))).toEqual({ r: 1, g: 0.5, b: 0.5, a: 1 });
  });

  it('keeps the hue of a saturated colour', () => {
    // Saturation 0.75, so the dimmest channel becomes 0.25. Green sits a third of the way up.
    const tint = lightIconModulate(light('Color(0.2, 0.4, 0.8, 1)'));
    expect([tint.r, tint.g, tint.b]).toEqual([0.25, 0.5, 1].map((channel) => expect.closeTo(channel, 10)));
  });

  it('gives white for a grey, which has no saturation', () => {
    expect(lightIconModulate(light('Color(0.5, 0.5, 0.5, 1)'))).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('gives white for black, where Godot reads hue 0 and saturation 0', () => {
    expect(lightIconModulate(light('Color(0, 0, 0, 1)'))).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('drops the light colour alpha, as set_hsv does with its default alpha', () => {
    expect(lightIconModulate(light('Color(1, 0, 0, 0.2)')).a).toBe(1);
  });
});
