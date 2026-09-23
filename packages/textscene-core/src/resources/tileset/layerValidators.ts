/**
 * TileSet's four flat indexed layer families: occlusion, physics, navigation and
 * custom data. Each leaf's guard is its `ERR_FAIL_COND_V(p_value.get_type() != …)`.
 * The setters' `ERR_FAIL_INDEX` bounds a sibling count no per-property validator
 * sees (ADR-0032).
 */

import { indexedFamilyValidator } from '../../linter/validators/indexedFamily.js';
import { layerBitmask, v } from '../../linter/validators/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

/** Why an index below zero never names a layer, per family. */
const droppedNegative = (noun: string, cite: string) => (index: number) =>
  `${noun} index ${index} must be non-negative. TileSet::_set fails ` +
  `ERR_FAIL_COND_V(index < 0, false) (${cite}) before the layer is reached, so the ` +
  'write never lands';

/**
 * A flat `<prefix><i>/<leaf>` family. `_set` gates on `trim_prefix(...).is_valid_int()`
 * (tile_set.cpp:3839, :3859, :3928, :3942), so `occlusion_layer_x/light_mask` names
 * no layer and the write drops. Each branch then refuses a negative index.
 */
function layerFamily(opts: {
  prefix: string;
  noun: string;
  leaves: Readonly<Record<string, PropertyValidator>>;
  negativeCite: string;
  code: string;
}): PropertyValidator {
  return indexedFamilyValidator({
    prefix: opts.prefix,
    leaves: opts.leaves,
    unknownCode: `INVALID_TILESET_${opts.code}_KEY`,
    describes: `TileSet ${opts.noun} layer`,
    accepts: `${opts.prefix}<i>/<leaf>`,
    indexParse: 'is_valid_int',
    negativeIndex: {
      cite: opts.negativeCite,
      code: `INVALID_TILESET_${opts.code}_INDEX`,
      message: droppedNegative(opts.noun, opts.negativeCite),
    },
  });
}

const occlusionLayer = layerFamily({
  prefix: 'occlusion_layer_',
  noun: 'Occlusion',
  negativeCite: 'tile_set.cpp:3842',
  code: 'OCCLUSION_LAYER',
  leaves: {
    // tile_set.cpp:4148, PROPERTY_HINT_LAYERS_2D_RENDER. The setter takes `int`
    // (tile_set.h:442) and bare-assigns it (:622).
    light_mask: layerBitmask('light_mask', { hinted: 'tile_set.cpp:4148', width: 'int32' }),
    // tile_set.cpp:4151, Variant::BOOL; :3851 refuses any other type.
    sdf_collision: v.boolean('sdf_collision'),
  },
});

const physicsLayer = layerFamily({
  prefix: 'physics_layer_',
  noun: 'Physics',
  negativeCite: 'tile_set.cpp:3862',
  code: 'PHYSICS_LAYER',
  leaves: {
    // tile_set.cpp:4162 / :4165, PROPERTY_HINT_LAYERS_2D_PHYSICS over setters
    // taking `uint32_t` (tile_set.h:453, :455) and bare-assigning (:686, :697).
    collision_layer: layerBitmask('collision_layer', {
      hinted: 'tile_set.cpp:4162',
      width: 'uint32',
    }),
    collision_mask: layerBitmask('collision_mask', {
      hinted: 'tile_set.cpp:4165',
      width: 'uint32',
    }),
    // tile_set.cpp:4172, Variant::FLOAT with PROPERTY_HINT_NONE; the setter
    // (:706) assigns the `real_t` unaltered, so both ends stay open.
    collision_priority: v.float('collision_priority'),
    // tile_set.cpp:4179, an OBJECT slot hinted `PhysicsMaterial`. `_set` (:3884)
    // converts the value to `Ref<PhysicsMaterial>` with no type check and stores
    // whatever comes out, so a cleared slot is legal here.
    physics_material: v.resourceReference('physics_material'),
  },
});

const navigationLayer = layerFamily({
  prefix: 'navigation_layer_',
  noun: 'Navigation',
  negativeCite: 'tile_set.cpp:3932',
  code: 'NAVIGATION_LAYER',
  leaves: {
    // tile_set.cpp:4201, PROPERTY_HINT_LAYERS_2D_NAVIGATION; the setter takes
    // `uint32_t` (tile_set.h:489) and bare-assigns it (:1015).
    layers: layerBitmask('layers', { hinted: 'tile_set.cpp:4201', width: 'uint32' }),
  },
});

const customDataLayer = layerFamily({
  prefix: 'custom_data_layer_',
  noun: 'Custom data',
  negativeCite: 'tile_set.cpp:3945',
  code: 'CUSTOM_DATA_LAYER',
  leaves: {
    // tile_set.cpp:4211, Variant::STRING; :3947 refuses a non-string. A name that
    // collides with another layer's is `set_custom_data_layer_name`'s ERR_FAIL_MSG
    // (:1117), a question about sibling keys, not this value.
    name: v.quotedString('name'),
    // tile_set.cpp:4212's hint string is built at :4205-4208 as "Any" plus every
    // `Variant::get_type_name(i)` for `i < VARIANT_MAX`, so it names 0..38
    // (variant.h:96-145). `set_custom_data_layer_type` (:1141) casts the int
    // into the enum and assigns, checking nothing, so the hint alone bounds it.
    type: v.int('type', { min: 0, max: 38, hinted: 'tile_set.cpp:4212' }),
  },
});

/** The four families, as registry keys. All glued-index, single-leaf-segment. */
export const layerFamilyKeys: Readonly<Record<string, PropertyValidator>> = {
  'occlusion_layer_#/*': occlusionLayer,
  'physics_layer_#/*': physicsLayer,
  'navigation_layer_#/*': navigationLayer,
  'custom_data_layer_#/*': customDataLayer,
};
