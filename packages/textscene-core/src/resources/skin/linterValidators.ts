/**
 * Skin's properties, which `_get_property_list` builds by hand (`scene/resources/3d/skin.cpp:132-139`):
 * `bind_count`, then `bind/<i>/name`, `bone` and `pose` for each bind.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../linter/validators/indexedFamily.js';
import { v } from '../../linter/validators/index.js';

const bindValidator = indexedFamilyValidator({
  prefix: 'bind/',
  leaves: {
    // skin.cpp:136, Variant::STRING_NAME. set_bind_name (:55-63) assigns.
    name: v.stringName('name'),
    // :137, a range hint "0,16384,1,or_greater". set_bind_bone (:65-69) assigns, so the floor warns.
    bone: v.int('bone', { min: 0, hinted: { min: 'skin.cpp:137' } }),
    // :138, Variant::TRANSFORM3D. set_bind_pose (:71-75) assigns.
    pose: v.transform3d('pose'),
  },
  unknownCode: 'INVALID_SKIN_BIND_KEY',
  describes: 'bind',
  accepts: 'bind/(index)/(leaf) — name, bone, pose',
  // `_set` reads the index with a bare `get_slicec('/', 1).to_int()` (skin.cpp:94).
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'skin.cpp:56',
    code: 'INVALID_SKIN_BIND_INDEX',
    message: (index) =>
      `Bind index ${index} must be non-negative. set_bind_* fails its index check (skin.cpp:56), so the value is never applied`,
  },
});

validatorRegistry.registerAll('Skin', {
  // :133, a range hint "0,16384,1,or_greater". set_bind_count refuses a negative count (:34).
  bind_count: v.int('bind_count', { min: 0, enforced: { min: 'skin.cpp:34' } }),
  'bind/*': bindValidator,
});
