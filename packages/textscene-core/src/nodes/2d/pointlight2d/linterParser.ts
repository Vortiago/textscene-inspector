/**
 * PointLight2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it. Light2D's own
// properties (enabled, color, energy, blend_mode, the range/shadow family) now
// live on the tier, which carries the hop to Node2D in turn.
import '../lights/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/** 0 is altered (error); anything else outside the hint band only warns. */
const TEXTURE_SCALE_HINT_MIN = 0.01;
const TEXTURE_SCALE_HINT_MAX = 50;

const textureScaleValidator: PropertyValidator = (key, value, line) => {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return propertyError(
      key,
      line,
      `Property 'texture_scale' must be a number, got: "${value}"`,
      'INVALID_TEXTURE_SCALE_FORMAT'
    );
  }
  if (parsed === 0) {
    return propertyError(
      key,
      line,
      "Property 'texture_scale' of 0 is replaced with CMP_EPSILON by set_texture_scale (light_2d.cpp:444), so the value in the file is not the one the engine uses",
      'INVALID_TEXTURE_SCALE_VALUE'
    );
  }
  if (parsed < TEXTURE_SCALE_HINT_MIN || parsed > TEXTURE_SCALE_HINT_MAX) {
    return propertyError(
      key,
      line,
      `Property 'texture_scale' must be ${TEXTURE_SCALE_HINT_MIN}-${TEXTURE_SCALE_HINT_MAX} (got ${parsed})`,
      'INVALID_TEXTURE_SCALE_VALUE',
      'warning'
    );
  }
  return null;
};
textureScaleValidator.accepts = `float ${TEXTURE_SCALE_HINT_MIN}-${TEXTURE_SCALE_HINT_MAX}, never exactly 0`;
// The error branch is the stronger claim, so it carries the tag; the warning
// branch cites light_2d.cpp:479 in the comment at its call site.
textureScaleValidator.grounding = { kind: 'enforced', cite: 'light_2d.cpp:444' };

validatorRegistry.registerAll('PointLight2D', {
  // light_2d.cpp:480 hints "0,1024,1,or_greater,suffix:px" (or_greater opens
  // the ceiling, so only the 0 floor is checked). The shared setter
  // Light2D::set_height (light_2d.cpp:89-92) assigns unconditionally.
  // DirectionalLight2D hints the SAME property "0,1,0.01" (light_2d.cpp:503) —
  // a different bound on the same setter — so this stays per-leaf rather than
  // moving to the Light2D tier.
  height: v.nonNegativeFloat('height', { hinted: 'light_2d.cpp:480' }),
  offset: v.vector2('offset'),
  texture: v.resourceReference('texture'),
  // Two statements with DIFFERENT authority over different values, which no
  // single bound can express, so this one is hand-rolled.
  //
  // Exactly 0 is ALTERED: set_texture_scale bumps it to CMP_EPSILON
  // (light_2d.cpp:444-446) to avoid a zero-scale quad. An altered value is the
  // error tier. Every OTHER out-of-range value, negative included, passes
  // through unclamped, so only the hint "0.01,50,0.01" (light_2d.cpp:479,
  // closed at both ends) excludes it, which is a warning.
  //
  // A plain `min: 0.01, enforced` would error on -5, a value Godot keeps; the
  // earlier `nonNegativeFloat` floored at 0 and so let the one genuinely
  // altered value through clean. Both are wrong in opposite directions.
  texture_scale: textureScaleValidator,
});
