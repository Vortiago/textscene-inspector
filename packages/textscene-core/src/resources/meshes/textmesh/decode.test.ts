/**
 * TextMesh decode. Defaults: `primitive_meshes.h:581-600`. The setters clamp `font_size`,
 * `pixel_size`, `curve_step` and `depth` (`primitive_meshes.cpp:3811-3912`) and refuse an alignment
 * past the enum (`:3712-3733`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { AutowrapMode, JustificationFlag } from '../../../godot/text/textServerEnums';
import { decodeTextMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeTextMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeTextMesh({})).toEqual({
      text: '',
      fontSize: 16,
      horizontalAlignment: 1,
      verticalAlignment: 1,
      isUppercase: false,
      lineSpacing: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      justificationFlags:
        JustificationFlag.WORD_BOUND |
        JustificationFlag.KASHIDA |
        JustificationFlag.SKIP_LAST_LINE |
        JustificationFlag.DO_NOT_SKIP_SINGLE_LINE,
      depth: Math.fround(0.05),
      width: 500,
      pixelSize: Math.fround(0.01),
      curveStep: 0.5,
      offset: { x: 0, y: 0 },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    expect(
      decodeTextMesh({
        text: '"Hog\\nTextMesh"',
        font: 'ExtResource("3_ds7iv")',
        font_size: '64',
        horizontal_alignment: '0',
        vertical_alignment: '2',
        uppercase: 'true',
        line_spacing: '4.5',
        autowrap_mode: '3',
        justification_flags: '3',
        depth: '0.2',
        width: '120.0',
        pixel_size: '0.02',
        curve_step: '2.0',
        offset: 'Vector2(10, -5)',
      })
    ).toEqual({
      text: 'Hog\nTextMesh',
      fontSize: 64,
      horizontalAlignment: 0,
      verticalAlignment: 2,
      isUppercase: true,
      lineSpacing: 4.5,
      autowrapMode: 3,
      justificationFlags: 3,
      depth: Math.fround(0.2),
      width: 120,
      pixelSize: Math.fround(0.02),
      curveStep: 2,
      offset: { x: 10, y: -5 },
    });
  });

  it('clamps font_size to 1 and 127, the bound of the setter and not of its hint', () => {
    expect([
      decodeTextMesh({ font_size: '0' }).fontSize,
      decodeTextMesh({ font_size: '300' }).fontSize,
    ]).toEqual([1, 127]);
  });

  it('clamps pixel_size to 0.0001 and 128', () => {
    expect([
      decodeTextMesh({ pixel_size: '0' }).pixelSize,
      decodeTextMesh({ pixel_size: '500' }).pixelSize,
    ]).toEqual([Math.fround(0.0001), 128]);
  });

  it('clamps curve_step to 0.1 and 10', () => {
    expect([
      decodeTextMesh({ curve_step: '0' }).curveStep,
      decodeTextMesh({ curve_step: '50' }).curveStep,
    ]).toEqual([Math.fround(0.1), 10]);
  });

  it('raises a negative depth to 0', () => {
    expect(decodeTextMesh({ depth: '-3.0' }).depth).toBe(0);
  });

  it('keeps the centre alignment for an alignment the setter refuses', () => {
    const mesh = decodeTextMesh({ horizontal_alignment: '4', vertical_alignment: '-1' });
    expect([mesh.horizontalAlignment, mesh.verticalAlignment]).toEqual([1, 1]);
  });

  it('accepts the fill alignment on both axes', () => {
    const mesh = decodeTextMesh({ horizontal_alignment: '3', vertical_alignment: '3' });
    expect([mesh.horizontalAlignment, mesh.verticalAlignment]).toEqual([3, 3]);
  });

  it('warns then falls back for a malformed font_size', () => {
    expect(decodeTextMesh({ font_size: 'big' }).fontSize).toBe(16);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
