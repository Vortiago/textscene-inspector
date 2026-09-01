/**
 * FogVolume strict validators for linting.
 *
 * Declare only FogVolume's OWN members — the ones doc/classes/FogVolume.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * fog_volume.cpp:46-48 (`FogVolume::_bind_methods`) is the only ADD_PROPERTY
 * site; no PropertyListHelper, ADD_ARRAY_COUNT, or hand-rolled `_set`/`_get`/
 * property-list override exists for this class beyond the `_validate_property`
 * override below (which only ever hides `size`, never adds a key), and the
 * `#ifndef DISABLE_DEPRECATED` `_set`/`_get` pair (fog_volume.cpp:56-70) only
 * reads/writes the retired Godot-3.x `extents` alias, which a current-format
 * `.tscn` never carries.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, tupleComponent, v, VECTOR3_REGEX } from '../../../linter/validators/index.js';
import { slotComponents, slotComponentsAltered } from '../../../godot/int.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `size`'s floor is genuinely TWO different numbers, not one bound at two
 * severities: the setter clamps a negative component up to 0
 * (`size = size.maxf(0);`, fog_volume.cpp:78 — Vector3::maxf is a
 * per-component MAX against the scalar, core/math/vector3.h:105) — an
 * ENFORCED floor — while the ADD_PROPERTY hint separately asks for every
 * component to be >= 0.01 (fog_volume.cpp:46, `"0.01,1024,0.01,or_greater"`)
 * with nothing in the setter enforcing THAT floor, so a component in
 * [0, 0.01) loads unaltered — a merely HINTED floor. `or_greater` opens the
 * 1024 ceiling, so there is no warning on the high end.
 *
 * `v.boundedVector3` (linter/validators/v.ts) carries one numeric value per
 * end, with severity chosen by which citation was given for that end — it
 * cannot express two different thresholds sharing one end, so this is
 * hand-rolled rather than forced through it.
 *
 * `nan`/`inf`/`-inf` components: every comparison against `nan` here is
 * false, so a `nan` component is accepted silently, matching how every other
 * float validator in this codebase treats a MAX()-based clamp (e.g. Decal's
 * `upper_fade`/`lower_fade`, decal.cpp:89/:98, the same `MAX(p, 0.0)` shape) —
 * only an explicit `ERR_FAIL_COND(!is_finite(...))` earns the `finite` guard,
 * and `set_size` has none. `-inf` IS caught by the `< 0` branch below: Godot's
 * `MAX(-inf, 0)` returns `0`, the same alteration a negative finite value gets.
 */
const sizeValidator: PropertyValidator = (key, value, line) => {
  const match = VECTOR3_REGEX.exec(value);
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'size' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`,
      'INVALID_SIZE_FORMAT'
    );
  }
  // The literals as written beside the numbers: `NaN`/`Infinity` are not
  // spellings a `.tscn` can carry, so echoing them named no text to change.
  const written = `Vector3(${[match[1], match[2], match[3]].map((t) => t!.trim()).join(', ')})`;
  const captures = [match[1], match[2], match[3]];
  // Ahead of both floors, which cannot express it: an altered component reads
  // back NaN, and `NaN < 0` and `NaN < 0.01` are both false. The message quotes
  // the literal, never the stored number — `_to_int`'s float branch is
  // undefined behaviour (variant.h:369-370).
  if (slotComponentsAltered(value, 'Vector3', captures)) {
    return propertyError(
      key,
      line,
      `Property 'size' has a component Godot cannot store in the integer spelling it is written in, got: ${written}. The file loads, but the components are narrowed at parse time to a number the file does not state.`,
      'INVALID_SIZE_VALUE'
    );
  }
  // `slotComponents`, not bare `tupleComponent`: VECTOR3_REGEX admits the
  // `Vector3i(...)` spelling `can_convert_strict` converts, whose arguments are
  // narrowed through `_parse_construct<int32_t>` before the widening into this
  // float slot, so both floors were compared against a number Godot never holds.
  const parts = slotComponents(value, 'Vector3', captures, tupleComponent);
  if (parts.some((component) => component < 0)) {
    return propertyError(
      key,
      line,
      `Property 'size' components must be >= 0; Godot's setter clamps a negative component up to 0 (fog_volume.cpp:78), got: ${written}`,
      'INVALID_SIZE_VALUE'
    );
  }
  if (parts.some((component) => component < 0.01)) {
    return propertyError(
      key,
      line,
      `Property 'size' components should be >= 0.01 per the editor's range hint (fog_volume.cpp:46); Godot's setter accepts a smaller non-negative value unaltered, got: ${written}`,
      'INVALID_SIZE_VALUE',
      'warning'
    );
  }
  return null;
};
accepts(
  sizeValidator,
  'Vector3(x, y, z), each >= 0 (>= 0.01 recommended; 1024 ceiling is or_greater, so unbounded above)'
);
// Both citations kept (per v.ts's `ground()` convention) since the two ends
// of the SAME bound are grounded differently.
sizeValidator.grounding = { kind: 'enforced', cite: 'fog_volume.cpp:78, fog_volume.cpp:46' };
// The BOUND is the hint's 0.01 — the first threshold a descending component
// crosses, and the number fog_volume.cpp:46 states — reported at the hinted
// tier because nothing in `set_size` applies it. The stricter 0-clamp below it
// is a second branch of the same end, not a second bound, and `bounds` carries
// one number per end. Declared so the hint ledger can read what is implemented
// here; `ground()` does this for every DSL combinator and cannot reach a
// hand-rolled one.
sizeValidator.bounds = { min: 0.01 };
sizeValidator.tiers = { min: 'warning' };

validatorRegistry.registerAll('FogVolume', {
  size: sizeValidator,
  // fog_volume.cpp:47, PROPERTY_HINT_ENUM with 5 values (Ellipsoid/Cone/
  // Cylinder/Box/World). set_shape (:87-93) is a bare assignment — no
  // ERR_FAIL_INDEX on p_type, and neither Fog::fog_volume_set_shape
  // (servers/rendering/renderer_rd/environment/fog.cpp:97-105) — so an
  // out-of-range value is stored and simply never matches any shape branch
  // the renderer checks for; the hint is editor-only.
  shape: v.enumInt(
    'shape',
    0,
    4,
    { 0: 'ELLIPSOID', 1: 'CONE', 2: 'CYLINDER', 3: 'BOX', 4: 'WORLD' },
    { hinted: 'fog_volume.cpp:47' }
  ),
  // fog_volume.cpp:48, PROPERTY_HINT_RESOURCE_TYPE "FogMaterial,ShaderMaterial".
  // set_material (:99-106) takes any Ref<Material> and assigns it straight
  // through — the hint only filters the editor's resource picker, so this is
  // a format check on the reference syntax, not a bound.
  material: v.resourceReference('material'),
});
