import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseTextureProgressBar } from './parser';

const HEADING: ParsedHeading = { type: 'TextureProgressBar', attributes: { name: 'MyBar' } };

describe('parseTextureProgressBar', () => {
  it('parses every own member', () => {
    const props = parseTextureProgressBar(HEADING, {
      fill_mode: '4',
      nine_patch_stretch: 'true',
      radial_center_offset: 'Vector2(2, 3)',
      radial_fill_degrees: '270.0',
      radial_initial_angle: '45.0',
      stretch_margin_bottom: '4',
      stretch_margin_left: '4',
      stretch_margin_right: '4',
      stretch_margin_top: '4',
      texture_over: 'ExtResource("over")',
      texture_progress: 'ExtResource("progress")',
      texture_progress_offset: 'Vector2(1, 1)',
      texture_under: 'ExtResource("under")',
      tint_over: 'Color(1, 0.8, 0.8, 1)',
      tint_progress: 'Color(0.8, 1, 0.8, 1)',
      tint_under: 'Color(0.8, 0.8, 1, 1)',
    });
    expect(props.fillMode).toBe(4);
    expect(props.ninePatchStretch).toBe(true);
    expect(props.radialCenterOffset).toEqual({ x: 2, y: 3 });
    expect(props.radialFillDegrees).toBe(270);
    expect(props.radialInitialAngle).toBe(45);
    expect(props.stretchMarginBottom).toBe(4);
    expect(props.stretchMarginLeft).toBe(4);
    expect(props.stretchMarginRight).toBe(4);
    expect(props.stretchMarginTop).toBe(4);
    expect(props.textureOver).toBe('ExtResource("over")');
    expect(props.textureProgress).toBe('ExtResource("progress")');
    expect(props.textureProgressOffset).toEqual({ x: 1, y: 1 });
    expect(props.textureUnder).toBe('ExtResource("under")');
    expect(props.tintOver).toEqual({ r: 1, g: 0.8, b: 0.8, a: 1 });
    expect(props.tintProgress).toEqual({ r: 0.8, g: 1, b: 0.8, a: 1 });
    expect(props.tintUnder).toEqual({ r: 0.8, g: 0.8, b: 1, a: 1 });
  });

  it('leaves every own property undefined when absent', () => {
    const props = parseTextureProgressBar(HEADING, {});
    expect(props.fillMode).toBeUndefined();
    expect(props.ninePatchStretch).toBeUndefined();
    expect(props.textureOver).toBeUndefined();
    expect(props.textureProgress).toBeUndefined();
    expect(props.textureUnder).toBeUndefined();
    expect(props.tintUnder).toBeUndefined();
  });

  it('truncates a fractional stretch_margin_* toward zero (an INT slot, set_stretch_margin(Side, int))', () => {
    const props = parseTextureProgressBar(HEADING, { stretch_margin_left: '4.9' });
    expect(props.stretchMarginLeft).toBe(4);
  });

  it('also parses the Range base it reuses (value/min_value/max_value)', () => {
    const props = parseTextureProgressBar(HEADING, { value: '42', min_value: '0', max_value: '200' });
    expect(props.value).toBe(42);
    expect(props.minValue).toBe(0);
    expect(props.maxValue).toBe(200);
  });
});
