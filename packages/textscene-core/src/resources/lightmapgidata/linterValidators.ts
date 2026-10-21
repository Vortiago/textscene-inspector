/** LightmapGIData property validation. Each setter is in `scene/3d/lightmap_gi.cpp`. */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry, type PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { accepts, arrayLiteralElements, propertyError, v } from '../../linter/validators/index.js';
import { formatCode } from '../../linter/validators/v/codes.js';
import { splitTopLevel } from '../../godot/string/string.js';
import { variantShape } from '../../godot/variant/variantParser.js';
import { LIGHTMAP_USER_FIELDS } from '../../godot/scene/lightmapGi.js';
import { missingProbeDataField } from './probeData.js';

const userDataArray = v.arrayLiteral('user_data');

/** `_set_user_data` refuses an array that is not whole users (`lightmap_gi.cpp:84`). */
const userData: PropertyValidator = accepts((key, value, line) => {
  const shapeError = userDataArray(key, value, line);
  if (shapeError) return shapeError;
  const count = splitTopLevel(arrayLiteralElements(value)).length;
  if (count % LIGHTMAP_USER_FIELDS === 0) return null;
  return propertyError(
    key,
    line,
    `Property 'user_data' must hold whole users of ${LIGHTMAP_USER_FIELDS} elements (path, UV scale, slice, sub-instance), got ${count} element(s)`,
    formatCode('user_data', 'COUNT')
  );
}, `Array literal of ${LIGHTMAP_USER_FIELDS}-element users`);
userData.grounding = { kind: 'enforced', cite: 'lightmap_gi.cpp:84' };

/** `_set_probe_data` refuses a Dictionary without each field it reads (`lightmap_gi.cpp:275-281`). */
const probeData: PropertyValidator = accepts((key, value, line) => {
  if (variantShape(value) !== 'dictionary') {
    return propertyError(
      key,
      line,
      `Property 'probe_data' must be a Dictionary literal like { "bounds": AABB(…), … }, got: ${value}`,
      formatCode('probe_data')
    );
  }
  const missing = missingProbeDataField(value);
  if (missing === null) return null;
  return propertyError(
    key,
    line,
    `Property 'probe_data' must have a "${missing}" field, which _set_probe_data requires`,
    formatCode('probe_data', 'FIELD')
  );
}, 'Dictionary literal with bounds, points, tetrahedra, bsp, sh, interior and baked_exposure');
probeData.grounding = { kind: 'enforced', cite: 'lightmap_gi.cpp:275-281' };

validatorRegistry.registerAll('LightmapGIData', {
  lightmap_textures: v.arrayLiteral('lightmap_textures', {
    typedAs: 'TextureLayered',
    enforced: 'lightmap_gi.cpp:102',
  }),
  shadowmask_textures: v.arrayLiteral('shadowmask_textures', {
    typedAs: 'TextureLayered',
    enforced: 'lightmap_gi.cpp:135',
  }),
  uses_spherical_harmonics: v.boolean('uses_spherical_harmonics'),
  user_data: userData,
  probe_data: probeData,
  _uses_packed_directional: v.boolean('_uses_packed_directional'),
  // Deprecated: an older bake's spelling of `lightmap_textures`, which the setter hands on
  // (`lightmap_gi.cpp:317-318`).
  light_textures: v.arrayLiteral('light_textures', {
    typedAs: 'TextureLayered',
    enforced: 'lightmap_gi.cpp:318',
  }),
});
