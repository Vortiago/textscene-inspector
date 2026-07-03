/**
 * Issue #175 — Consolidate drifted value decoders onto the canonical float grammar.
 *
 * RED contract. Pins the BEHAVIOUR the consolidation must produce, against the one source of
 * grammar truth (`FLOAT_PATTERN_SOURCE` / `parseVector2` in `parser/vectors.ts`, the `*Or`
 * family in `parser/valueParsers.ts`, and the non-throwing `parseColor` in
 * `utils/colorParser.ts`). The framing the issue is explicit about:
 *
 *   "SHARE the float-grammar leaf + keep thin per-slice wrappers", NOT "collapse to one
 *   decoder everywhere." Each slice's absent/error contract (`undefined` / `{0,0}` / skip)
 *   legitimately DIFFERS and stays; only the float grammar must unify. The residual scalar
 *   bug is the NaN-leak from *truthy garbage only* — an authored "0" (truthy string) is not
 *   lost; only an unparseable-but-present value currently leaks NaN.
 *
 * The seam this pins (each maps to an acceptance criterion of #175):
 *   AC4  a promoted OPTIONAL Vector2 reader in valueParsers, sharing FLOAT_PATTERN_SOURCE;
 *   AC1  control + styleBox Vector2 reads go through the canonical grammar (loose-regex-only
 *        garbage no longer parses to NaN / a wrong number);
 *   AC2  the dead try/catch in control is gone — a malformed theme Color(...) is SKIPPED, not
 *        whitened to {1,1,1,1};
 *   AC3  the scalar reads (light / camera / mesh slices) no longer leak NaN on truthy garbage:
 *        concrete-default scalars warn-then-fall-back (floatOr/intOr), optional scalars fall to
 *        `undefined` — never NaN;
 *   AC6  the CONTEXT.md "Value decoder" note records that the absent/error contract may fork
 *        per slice while the grammar must not.
 *
 * These are the pinned contract cases; each converted slice keeps its own co-located parser
 * test (collapsed to "delegates to the canonical decoder" + its property→field mapping).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as logger from '../logger';
import { parseOptionalVector2 } from './valueParsers';
import { parseVector2, FLOAT_PATTERN_SOURCE } from './vectors';
import { heading } from './testing/parserKit';
import { parseControl } from '../nodes/2d/ui/control/parser';
import { styleBoxToCss } from '../r3f/controls/styleBoxToCss';
import { parseBaseLightProperties } from '../nodes/3d/lights/shared/parser';
import { parseDirectionalLight3D } from '../nodes/3d/lights/directionallight3d/parser';
import { parseCamera3D } from '../nodes/3d/camera3d/parser';
import { parseMeshInstance3D } from '../nodes/3d/meshinstance3d/parser';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // The slices warn through the pluggable module logger (`import { warn } from '../logger'`),
  // NOT console.warn — spy the module object so importers see the spy.
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------------------------
// AC4 — the promoted OPTIONAL Vector2 reader shares the canonical float grammar
// ---------------------------------------------------------------------------------------------
describe('#175 parseOptionalVector2 — the promoted optional reader on the shared grammar', () => {
  it('parses a valid Vector2, including the scientific notation Godot emits', () => {
    expect(parseOptionalVector2('Vector2(3, 4)')).toEqual({ x: 3, y: 4 });
    expect(parseOptionalVector2('Vector2(-1.5, -2)')).toEqual({ x: -1.5, y: -2 });
    expect(parseOptionalVector2('Vector2(1e-05, 2)')).toEqual({ x: 1e-5, y: 2 });
  });

  it('returns undefined (never NaN) for an absent value — no fallback, no warn', () => {
    expect(parseOptionalVector2(undefined)).toBeUndefined();
    expect(parseOptionalVector2('')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('REJECTS the malformed input the old loose [-\\d.eE+]+ copy wrongly accepted', () => {
    // The drifted control/styleBox copies matched a double sign or a dangling exponent and
    // parsed them to NaN / a wrong number. The anchored canonical grammar rejects them outright.
    expect(parseOptionalVector2('Vector2(--1, 2)')).toBeUndefined();
    expect(parseOptionalVector2('Vector2(1e-, 2)')).toBeUndefined();
    expect(parseOptionalVector2('Vector2(1.2.3, 4)')).toBeUndefined();
    expect(parseOptionalVector2('Vector2(1, 2) trailing-garbage')).toBeUndefined();
    expect(parseOptionalVector2('not a vector at all')).toBeUndefined();
  });

  it('shares ONE grammar with the canonical parseVector2 (same accept/reject frontier)', () => {
    // Whatever the throwing leaf rejects, the optional reader must also reject, and vice-versa —
    // that is what "share the leaf" means. `1.2.3` is the canonical example of a malformed float.
    expect(() => parseVector2('Vector2(1.2.3, 4)')).toThrow();
    expect(parseOptionalVector2('Vector2(1.2.3, 4)')).toBeUndefined();
    expect(parseVector2('Vector2(1e-05, 2)')).toEqual({ x: 1e-5, y: 2 });
    expect(parseOptionalVector2('Vector2(1e-05, 2)')).toEqual({ x: 1e-5, y: 2 });
    // It genuinely reuses the shared source, not a hand-copied regex.
    expect(FLOAT_PATTERN_SOURCE).toContain('eE');
  });
});

// ---------------------------------------------------------------------------------------------
// AC1 — control + styleBox Vector2 reads go through the canonical grammar
// ---------------------------------------------------------------------------------------------
describe('#175 control custom_minimum_size — canonical grammar, not the loose copy', () => {
  it('reads a valid Vector2', () => {
    const p = parseControl(heading('Control', { name: 'B' }), {
      custom_minimum_size: 'Vector2(120, 40)',
    });
    expect(p.customMinimumSize).toEqual({ x: 120, y: 40 });
  });

  it('leaves custom_minimum_size UNSET (never {x: NaN}) for loose-regex-only garbage', () => {
    const p = parseControl(heading('Control', { name: 'B' }), {
      custom_minimum_size: 'Vector2(--1, 2)',
    });
    expect(p.customMinimumSize).toBeUndefined();
  });
});

describe('#175 styleBox shadow_offset — canonical grammar, never emits NaN', () => {
  it('renders a valid shadow offset', () => {
    const style = styleBoxToCss('StyleBoxFlat', {
      shadow_size: '4',
      shadow_offset: 'Vector2(2, 3)',
    });
    expect(style.boxShadow).toContain('2px 3px');
    expect(String(style.boxShadow)).not.toContain('NaN');
  });

  it('falls back cleanly (no NaN in the CSS) for loose-regex-only garbage', () => {
    const style = styleBoxToCss('StyleBoxFlat', {
      shadow_size: '4',
      shadow_offset: 'Vector2(--1, 2)',
    });
    expect(String(style.boxShadow)).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------------------------------------
// AC2 — malformed theme Color is SKIPPED, not whitened (the dead try/catch is gone)
// ---------------------------------------------------------------------------------------------
describe('#175 control theme colors — malformed color skipped, not whitened', () => {
  it('keeps a valid theme color (including a genuine white)', () => {
    const p = parseControl(heading('Control', { name: 'L' }), {
      'theme_override_colors/font_color': 'Color(0.2, 0.18, 0.12, 1)',
      'theme_override_colors/bg_color': 'Color(1, 1, 1, 1)',
    });
    expect(p.themeOverrideColors?.font_color?.r).toBeCloseTo(0.2, 5);
    // A genuine white must still be stored — the skip is grammar-based, not "drop anything white".
    expect(p.themeOverrideColors?.bg_color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('SKIPS a malformed color instead of whitening it to {1,1,1,1}', () => {
    const p = parseControl(heading('Control', { name: 'L' }), {
      'theme_override_colors/font_color': 'notacolor',
      'theme_override_colors/bad_arity': 'Color(1, 1, 1)',
    });
    // The whole map stays unset because its only entries were malformed (currently the dead
    // try/catch lets parseColor's white fallback through, so both would be {1,1,1,1}).
    expect(p.themeOverrideColors).toBeUndefined();
  });

  it('keeps the valid colors and drops only the malformed one when mixed', () => {
    const p = parseControl(heading('Control', { name: 'L' }), {
      'theme_override_colors/font_color': 'Color(0.2, 0.18, 0.12, 1)',
      'theme_override_colors/broken': 'Color(nope)',
    });
    expect(p.themeOverrideColors?.font_color?.r).toBeCloseTo(0.2, 5);
    expect(p.themeOverrideColors?.broken).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// AC3 — scalar reads no longer leak NaN on truthy garbage
// ---------------------------------------------------------------------------------------------
describe('#175 concrete-default scalars — warn-then-fall-back, never NaN (floatOr/intOr)', () => {
  it('light_energy: garbage falls back to the default 1.0 and warns', () => {
    const result = parseBaseLightProperties({ light_energy: 'garbage' });
    expect(result.light_energy).toBe(1.0);
    expect(Number.isNaN(result.light_energy)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('the DirectionalLight3D wrapper inherits the fix', () => {
    const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });
    const result = parseDirectionalLight3D(h, { light_energy: 'garbage' });
    expect(result.light_energy).toBe(1.0);
  });

  it('camera3d fov: garbage falls back to 75.0 and warns (float path)', () => {
    const h = heading('Camera3D', { name: 'Cam', parent: '.' });
    const result = parseCamera3D(h, { fov: 'garbage' });
    expect(result.fov).toBe(75.0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('camera3d cull_mask: garbage falls back to the default int and warns (int path)', () => {
    const h = heading('Camera3D', { name: 'Cam', parent: '.' });
    const result = parseCamera3D(h, { cull_mask: 'garbage' });
    expect(result.cull_mask).toBe(1048575);
    expect(Number.isNaN(result.cull_mask)).toBe(false);
  });

  it('an absent value falls back SILENTLY — no warning for a missing property', () => {
    const result = parseBaseLightProperties({});
    expect(result.light_energy).toBe(1.0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('an authored value is honoured — the fallback only fires on absent/garbage', () => {
    const result = parseBaseLightProperties({ light_energy: '2.5' });
    expect(result.light_energy).toBe(2.5);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('#175 optional scalars — fall to undefined on garbage, never NaN', () => {
  it('shadow_bias: garbage stays undefined (optional contract preserved)', () => {
    const result = parseBaseLightProperties({ shadow_bias: 'not-a-number' });
    expect(result.shadow_bias).toBeUndefined();
  });

  it('shadow_blur / shadow_normal_bias: garbage stays undefined', () => {
    expect(parseBaseLightProperties({ shadow_blur: 'invalid' }).shadow_blur).toBeUndefined();
    const h = heading('DirectionalLight3D', { name: 'Sun', parent: '.' });
    expect(
      parseDirectionalLight3D(h, { shadow_normal_bias: 'abc' }).shadow_normal_bias
    ).toBeUndefined();
  });

  it('meshinstance visibility_range_begin: garbage stays undefined, never NaN', () => {
    const h = heading('MeshInstance3D', { name: 'Mesh', parent: '.' });
    const result = parseMeshInstance3D(h, { visibility_range_begin: 'garbage' });
    expect(result.visibilityRangeBegin).toBeUndefined();
  });

  it('meshinstance converted int/float fields: garbage stays undefined, never NaN', () => {
    // The remaining slice-converted optional reads (giLightmapScale/layers/fade_mode via
    // parseOptionalInt; the range margins via parseOptionalFloat) must drop truthy garbage
    // to undefined rather than leak NaN — same contract as visibility_range_begin above.
    const h = heading('MeshInstance3D', { name: 'Mesh', parent: '.' });
    const result = parseMeshInstance3D(h, {
      gi_lightmap_scale: 'garbage',
      visibility_range_begin_margin: 'garbage',
      visibility_range_end_margin: 'garbage',
      visibility_range_fade_mode: 'garbage',
      layers: 'garbage',
    });
    expect(result.giLightmapScale).toBeUndefined();
    expect(result.visibilityRangeBeginMargin).toBeUndefined();
    expect(result.visibilityRangeEndMargin).toBeUndefined();
    expect(result.visibilityRangeFadeMode).toBeUndefined();
    expect(result.layers).toBeUndefined();
  });

  it('camera3d frustum_offset: garbage falls back to {0,0} — never NaN (vec2Or path)', () => {
    const h = heading('Camera3D', { name: 'Cam', parent: '.' });
    const result = parseCamera3D(h, { frustum_offset: 'Vector2(--1, 2)' });
    expect(result.frustum_offset).toEqual({ x: 0, y: 0 });
    expect(Number.isNaN(result.frustum_offset.x)).toBe(false);
    expect(Number.isNaN(result.frustum_offset.y)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// AC6 — the CONTEXT.md Value-decoder note records the per-slice fork of the absent/error contract
// ---------------------------------------------------------------------------------------------
describe('#175 CONTEXT.md — the Value decoder note records the contract fork', () => {
  it('states the absent/error contract may fork per slice while the grammar is shared', () => {
    // cwd-independent read (runs under lint-staged / CI from the repo root too).
    const contextMd = readFileSync(join(import.meta.dirname, '../../../../CONTEXT.md'), 'utf8');
    const idx = contextMd.indexOf('Value decoder');
    expect(idx).toBeGreaterThan(-1);
    const note = contextMd.slice(idx, idx + 1400);
    expect(note).toMatch(/fork/i);
  });
});
