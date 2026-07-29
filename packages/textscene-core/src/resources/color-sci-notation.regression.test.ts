/**
 * Regression contract for #141 — Color decoders reject scientific-notation channels.
 *
 * The material/Environment `parseColor` and the Environment linter's colour check
 * matched channels with `[\d.]+`, which excludes `e`/`E`/`+`/`-`. So a normal Godot
 * color like `Color(1.8771e-06, 0.751954, 0.25936, 1)` fails: the material silently
 * drops albedo to default (try/catch), Environment's parse throws outright, and the
 * Environment linter reports a bogus colour-format error. The decoders must accept
 * Godot's full float grammar (sci-notation + sign) — WITHOUT loosening to accept
 * garbage and WITHOUT changing the throw-on-invalid contract.
 *
 * The linter half of this now rides on the shared `v.color` combinator, so the
 * guard lives in one float grammar rather than a per-resource regex.
 *
 * Also pins acceptance criterion 4: the StandardMaterial3D linter must actually
 * validate albedo_color (today no validator is registered).
 */

import { describe, it, expect } from 'vitest';
import { parseColor } from './materials/standardmaterial3d/parser';
import { parseEnvironment } from './environment/parser';
import { validatorRegistry } from '../linter/ValidatorRegistry';
import './environment/linterValidators';
import './materials/standardmaterial3d/linterValidators';

const MAT_SCI = 'Color(1.8771e-06, 0.751954, 0.25936, 1)';
const ENV_SCI = 'Color(1.01075e-06, 0, 0.451248, 1)';

describe('#141 scientific-notation color channels', () => {
  it('material parseColor decodes a sci-notation channel (does not throw)', () => {
    expect(parseColor(MAT_SCI)).toEqual({ r: 1.8771e-6, g: 0.751954, b: 0.25936, a: 1 });
  });

  it('Environment parseEnvironment decodes a sci-notation background_color (does not throw)', () => {
    expect(parseEnvironment({ background_color: ENV_SCI }).background_color).toEqual({
      r: 1.01075e-6,
      g: 0,
      b: 0.451248,
      a: 1,
    });
  });

  it('Environment linter accepts a sci-notation background_color (no false positive)', () => {
    const validator = validatorRegistry.findValidator('Environment', 'background_color');
    expect(validator).not.toBeNull();
    expect(validator!('background_color', ENV_SCI, 1)).toBeNull();
  });

  it('StandardMaterial3D linter validates albedo_color and accepts sci-notation', () => {
    const validator = validatorRegistry.findValidator('StandardMaterial3D', 'albedo_color');
    expect(validator).not.toBeNull();
    expect(validator!('albedo_color', MAT_SCI, 1)).toBeNull();
  });

  // --- regression guards: must keep passing after the fix ---

  it('still decodes a plain decimal color', () => {
    expect(parseColor('Color(0.5, 0.25, 0.125, 1)')).toEqual({ r: 0.5, g: 0.25, b: 0.125, a: 1 });
  });

  it('still throws on a genuinely invalid color (grammar not loosened to garbage)', () => {
    expect(() => parseColor('Color(not, a, color, x)')).toThrow();
  });

  // --- hardening (added on the /code-review pass; the green gate did not pin these) ---

  it('decodes Godot signed / HDR (>1) / leading-dot channels (the full grammar the fix enables)', () => {
    expect(parseColor('Color(-0.5, 1.0, 2.5, 1)')).toEqual({ r: -0.5, g: 1, b: 2.5, a: 1 });
    expect(parseColor('Color(.5, .25, .125, 1)')).toEqual({ r: 0.5, g: 0.25, b: 0.125, a: 1 });
  });

  it.each(['Color(1.2.3, 0, 0, 1)', 'Color(., 0, 0, 1)', 'Color(-, 0, 0, 1)', 'Color(1e, 0, 0, 1)'])(
    'still throws on the near-miss malformed color %s (grammar not over-loosened to accept it)',
    (bad) => {
      expect(() => parseColor(bad)).toThrow();
    },
  );

  it('Environment linter REJECTS a malformed background_color (the validator has teeth, not accept-all)', () => {
    const validator = validatorRegistry.findValidator('Environment', 'background_color');
    expect(validator!('background_color', 'Color(x, y, z, w)', 1)).not.toBeNull();
  });

  it('StandardMaterial3D linter REJECTS a malformed albedo_color (the validator has teeth, not accept-all)', () => {
    const validator = validatorRegistry.findValidator('StandardMaterial3D', 'albedo_color');
    expect(validator!('albedo_color', 'Color(x, y, z, w)', 1)).not.toBeNull();
  });

  it(
    'rejects a pathological long-digit Color in linear time (no ReDoS backtracking)',
    () => {
      // The non-matching `!` tail makes `\d+\.?\d*` backtrack O(n^2); the linear `\d+(?:\.\d*)?`
      // grammar fails fast. 100_000 is the regression-detection threshold: the linear form runs
      // in <1ms, a revert to the backtracking form takes seconds and blows the 2s timeout.
      const adversarial = `Color(${'9'.repeat(100_000)}!, 0, 0, 1)`;
      expect(() => parseColor(adversarial)).toThrow();
    },
    2000,
  );
});
