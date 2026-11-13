import { describe, expect, it } from 'vitest';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rgba } from '../../../../godot/math/math';
import type { LabelSettingsResource } from '../../../../resources/styles/labelsettings/types';
import { labelEffectLayers } from './effectLayers';

const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const GREEN: Rgba = { r: 0, g: 1, b: 0, a: 1 };
const BLUE: Rgba = { r: 0, g: 0, b: 1, a: 1 };
const GREY: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const CLEAR: Rgba = { r: 0, g: 0, b: 0, a: 0 };
const NO_OFFSET = { x: 0, y: 0 };

function settings(overrides: Partial<LabelSettingsResource>): LabelSettingsResource {
  return {
    lineSpacing: 3,
    paragraphSpacing: 0,
    fontSize: 16,
    fontColor: { r: 1, g: 1, b: 1, a: 1 },
    outlineSize: 0,
    outlineColor: BLACK,
    shadowSize: 0,
    shadowColor: CLEAR,
    shadowOffset: { x: 1, y: 1 },
    stackedOutlines: [],
    stackedShadows: [],
    ...overrides,
  };
}

function labelWith(overrides: Partial<SolveNode>): SolveNode {
  return withThemeItems({
    ...emptySolveNode(),
    path: 'L',
    node: controlNode('L', 'Label', { name: 'L' }),
    ...overrides,
  });
}

function withSettings(overrides: Partial<LabelSettingsResource>): SolveNode {
  return labelWith({ labelSettings: settings(overrides) });
}

const ringSizes = (layers: ReturnType<typeof labelEffectLayers>) =>
  layers.filter((layer) => layer.kind === 'ring').map((layer) => layer.ringSizePx);

describe('labelEffectLayers outlines (label.cpp:852-879)', () => {
  it('draws stacked rings from the last index down, each at the total less the sizes drawn before it', () => {
    const layers = labelEffectLayers(
      withSettings({
        outlineSize: 4,
        stackedOutlines: [
          { size: 8, color: RED },
          { size: 8, color: GREEN },
        ],
      })
    );
    expect(layers).toEqual([
      { kind: 'ring', color: GREEN, offset: NO_OFFSET, ringSizePx: 20 },
      { kind: 'ring', color: RED, offset: NO_OFFSET, ringSizePx: 12 },
      { kind: 'ring', color: BLACK, offset: NO_OFFSET, ringSizePx: 4 },
    ]);
  });

  it('skips a stacked outline of size 0 and leaves it out of the total', () => {
    const layers = labelEffectLayers(
      withSettings({
        outlineSize: 4,
        stackedOutlines: [
          { size: 8, color: RED },
          { size: 0, color: GREEN },
        ],
      })
    );
    expect(layers.map((layer) => [layer.color, layer.ringSizePx])).toEqual([
      [RED, 12],
      [BLACK, 4],
    ]);
  });

  it('skips a stacked outline of negative size', () => {
    const layers = labelEffectLayers(withSettings({ stackedOutlines: [{ size: -3, color: RED }] }));
    expect(layers).toEqual([]);
  });

  it('draws the stacked rings when the base outline is size 0, down to the first entry', () => {
    const layers = labelEffectLayers(withSettings({ stackedOutlines: [{ size: 5, color: RED }] }));
    expect(ringSizes(layers)).toEqual([5]);
  });

  it('draws no base ring at an outline colour of alpha 0', () => {
    const layers = labelEffectLayers(withSettings({ outlineSize: 4, outlineColor: CLEAR }));
    expect(layers).toEqual([]);
  });

  it('reads the theme outline when the Label has no settings, and has no stacked layers', () => {
    const layers = labelEffectLayers(
      labelWith({ constants: { outline_size: 3 }, colors: { font_outline_color: RED } })
    );
    expect(layers).toEqual([{ kind: 'ring', color: RED, offset: NO_OFFSET, ringSizePx: 3 }]);
  });
});

describe('labelEffectLayers shadows (label.cpp:828-850)', () => {
  const SHADOW_OFFSET = { x: 2, y: 2 };

  it('draws the shadow ring, then the shadow, then each stacked shadow from the last index down', () => {
    const layers = labelEffectLayers(
      withSettings({
        shadowSize: 3,
        shadowColor: GREY,
        shadowOffset: SHADOW_OFFSET,
        stackedShadows: [
          { offset: { x: 6, y: 6 }, color: BLUE, outlineSize: 4 },
          { offset: { x: 12, y: 12 }, color: RED, outlineSize: 0 },
        ],
      })
    );
    expect(layers).toEqual([
      { kind: 'ring', color: GREY, offset: SHADOW_OFFSET, ringSizePx: 3 },
      { kind: 'plain', color: GREY, offset: SHADOW_OFFSET, ringSizePx: 0 },
      { kind: 'plain', color: RED, offset: { x: 12, y: 12 }, ringSizePx: 0 },
      { kind: 'ring', color: BLUE, offset: { x: 6, y: 6 }, ringSizePx: 4 },
      { kind: 'plain', color: BLUE, offset: { x: 6, y: 6 }, ringSizePx: 0 },
    ]);
  });

  it('draws the stacked shadows when the base shadow is transparent', () => {
    const layers = labelEffectLayers(
      withSettings({ stackedShadows: [{ offset: { x: 1, y: 1 }, color: BLUE, outlineSize: 0 }] })
    );
    expect(layers).toEqual([{ kind: 'plain', color: BLUE, offset: { x: 1, y: 1 }, ringSizePx: 0 }]);
  });

  it('draws no shadow ring at a shadow size of 0 but still draws the shadow', () => {
    const layers = labelEffectLayers(withSettings({ shadowSize: 0, shadowColor: GREY }));
    expect(layers.map((layer) => layer.kind)).toEqual(['plain']);
  });

  it('draws the stacked shadows before the stacked outlines', () => {
    const layers = labelEffectLayers(
      withSettings({
        stackedShadows: [{ offset: { x: 1, y: 1 }, color: BLUE, outlineSize: 0 }],
        stackedOutlines: [{ size: 2, color: RED }],
      })
    );
    expect(layers.map((layer) => layer.kind)).toEqual(['plain', 'ring']);
  });

  it('reads the theme shadow when the Label has no settings', () => {
    const layers = labelEffectLayers(
      labelWith({
        constants: { shadow_outline_size: 2, shadow_offset_x: 4, shadow_offset_y: 5 },
        colors: { font_shadow_color: GREY },
      })
    );
    expect(layers).toEqual([
      { kind: 'ring', color: GREY, offset: { x: 4, y: 5 }, ringSizePx: 2 },
      { kind: 'plain', color: GREY, offset: { x: 4, y: 5 }, ringSizePx: 0 },
    ]);
  });
});
