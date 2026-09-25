/** PointLight2D strict validators. */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor. Light2D's
// own properties live on that tier, which carries the hop to Node2D.
import '../lights/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';

/** 0 is altered (error); anything else outside the hint band only warns. */
const TEXTURE_SCALE_HINT_MIN = 0.01;
const TEXTURE_SCALE_HINT_MAX = 50;

/**
 * Hand-rolled, since no single bound holds both tiers. Exactly 0 is altered to
 * CMP_EPSILON (light_2d.cpp:444-446): an error. Any other value, negative
 * included, passes unclamped, so only the closed hint (light_2d.cpp:479) warns.
 */
const textureScaleValidator: PropertyValidator = (key, value, line) => {
  // `parseGodotFloat`, not `parseFloat`: `light_2d.cpp:444` substitutes only for
  // exactly 0, so a non-finite literal is a value the setter keeps.
  const parsed = parseGodotFloat(value);
  if (parsed === null) {
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
// Both range ends come from the hint alone, so both warn. The error above is
// the exactly-zero replacement, which is not an end of the range.
textureScaleValidator.tiers = { min: 'warning', max: 'warning' };
// The numbers beside the tiers: light_2d.cpp:479 hints "0.01,50,0.01". A tier
// without them is a bound no guard can compare against the engine.
textureScaleValidator.bounds = { min: TEXTURE_SCALE_HINT_MIN, max: TEXTURE_SCALE_HINT_MAX };

validatorRegistry.registerAll('PointLight2D', {
  // light_2d.cpp:480 hints "0,1024,1,or_greater,suffix:px", so only the floor is
  // checked. Light2D::set_height (light_2d.cpp:89-92) assigns unconditionally.
  // DirectionalLight2D hints "0,1,0.01" (light_2d.cpp:503) on the same setter, so
  // this stays per leaf.
  height: v.nonNegativeFloat('height', { hinted: 'light_2d.cpp:480' }),
  offset: v.vector2('offset'),
  texture: v.resourceReference('texture'),
  // A plain `min: 0.01, enforced` would error on -5, a value Godot keeps, and a
  // `nonNegativeFloat` would pass the one altered value, 0.
  texture_scale: textureScaleValidator,
});
