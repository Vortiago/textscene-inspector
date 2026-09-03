/**
 * PointLight2D semantic rules — the required texture, and the range windows
 * that can never match.
 *
 * Godot's tests are `>= min && <= max` on both windows (rasterizer line 850 for
 * z, `renderer_viewport.cpp`'s per-canvas loop for the layer), and nothing swaps
 * an inverted pair. So `min > max` is an EMPTY interval: the light is enabled,
 * costs a full accumulation pass, and reaches nothing. That is authoring error
 * rather than a malformed file, so it warns.
 */

import { describe, it, expect } from 'vitest';
import {
  expectDiagnostic,
  expectNoDiagnostic,
  lint,
  node,
  scene as sceneOf,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** Every range-window test below is about the windows, not the texture. */
const WITH_TEXTURE = { texture: 'ExtResource("1")' };
const TEXTURE = '[ext_resource type="Texture2D" path="res://light.png" id="1"]';
const scene = (...blocks: string[]) => sceneOf(TEXTURE, ...blocks);

describe('PointLight2D z-range — a non-finite bound is not a bound', () => {
  it('says nothing, and never prints NaN', () => {
    for (const spelling of ['inf', 'nan', 'inf_neg']) {
      expectNoDiagnostic(
        scene(node('PointLight2D', { range_z_min: spelling, range_z_max: 1024 })),
        { ruleName: 'pointlight2d-inverted-z-range' }
      );
    }
  });
});

describe('PointLight2D linter', () => {
  it("warns when 'texture' is absent (light_2d.cpp:431-439)", () => {
    expectDiagnostic(scene(node('PointLight2D')), {
      ruleName: 'pointlight2d-requires-texture',
      severity: 'warning',
      contains: ['texture'],
    });
  });

  it('says nothing about texture once one is authored', () => {
    expectNoDiagnostic(scene(node('PointLight2D', WITH_TEXTURE)), {
      ruleName: 'pointlight2d-requires-texture',
    });
  });

  it('warns when the z window is inverted', () => {
    expectDiagnostic(
      scene(node('PointLight2D', { ...WITH_TEXTURE, range_z_min: 5, range_z_max: 4 })),
      {
        ruleName: 'pointlight2d-inverted-z-range',
        severity: 'info',
        contains: ['range_z_min', 'range_z_max'],
      }
    );
  });

  it('warns when the layer window is inverted', () => {
    expectDiagnostic(
      scene(node('PointLight2D', { ...WITH_TEXTURE, range_layer_min: 2, range_layer_max: 1 })),
      {
        ruleName: 'pointlight2d-inverted-layer-range',
        severity: 'info',
        contains: ['range_layer_min', 'range_layer_max'],
      }
    );
  });

  it('never raises an error, so a fixture carrying one still lints clean', () => {
    const diagnostics = lint(
      scene(
        node('PointLight2D', {
          ...WITH_TEXTURE,
          range_z_min: 5,
          range_z_max: 4,
          range_layer_min: 2,
          range_layer_max: 1,
        })
      )
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.filter((d) => d.severity === 'info')).toHaveLength(2);
  });

  it("accepts a single-value window, which is Godot's own layer default", () => {
    // range_layer_min = range_layer_max = 0 is what every untouched light has;
    // an off-by-one that treated equality as inverted would warn on the corpus.
    expectNoDiagnostic(
      scene(
        node('PointLight2D', {
          ...WITH_TEXTURE,
          range_layer_min: 0,
          range_layer_max: 0,
          range_z_min: 3,
          range_z_max: 3,
        })
      ),
      { ruleName: 'pointlight2d-inverted-layer-range' }
    );
    expectNoDiagnostic(
      scene(node('PointLight2D', { ...WITH_TEXTURE, range_z_min: 3, range_z_max: 3 })),
      { ruleName: 'pointlight2d-inverted-z-range' }
    );
  });

  it('says nothing about ranges on a light that authors no window at all', () => {
    expect(lint(scene(node('PointLight2D', WITH_TEXTURE)))).toEqual([]);
  });

  it("compares an authored bound against the ABSENT half's default", () => {
    // `range_z_max = -2000` alone is already empty against the default
    // range_z_min of -1024. Reading only pairs that are both authored would
    // miss the commonest way to write the mistake.
    expectDiagnostic(scene(node('PointLight2D', { ...WITH_TEXTURE, range_z_max: -2000 })), {
      ruleName: 'pointlight2d-inverted-z-range',
      severity: 'info',
    });
    expectDiagnostic(scene(node('PointLight2D', { ...WITH_TEXTURE, range_layer_min: 1 })), {
      ruleName: 'pointlight2d-inverted-layer-range',
      severity: 'info',
    });
  });

  it('ignores a malformed bound, which the validators already report', () => {
    const diagnostics = lint(
      scene(node('PointLight2D', { ...WITH_TEXTURE, range_z_min: '"five"' }))
    );
    expect(
      diagnostics.filter((d) => d.ruleName === 'pointlight2d-inverted-z-range')
    ).toEqual([]);
  });
});
