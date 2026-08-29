/**
 * MeshLibrary property validation.
 *
 * One family, `item/<i>/<leaf>`, and nothing else: MeshLibrary declares no
 * `ADD_PROPERTY` at all. `_get_property_list` (mesh_library.cpp:143-156) builds
 * nine keys per live item by hand, so no sweep over declared properties can see
 * this family and every value on it was silently accepted.
 *
 * The leaves are what `_set` APPLIES (mesh_library.cpp:46-96), which is three
 * keys wider than what `_get_property_list` writes — `shape`, `navmesh` and
 * `navmesh_transform` land without ever being saved. Registering only the saved
 * nine would report a write the engine performs.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry, type PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../linter/validators/indexedFamily.js';
import { arrayLiteralElements, layerBitmask, propertyError, v } from '../../linter/validators/index.js';
import { dropTrailingComma, splitTopLevel } from '../../godot/index.js';

/**
 * `RS::ShadowCastingSetting`, the same four constants `GeometryInstance3D`
 * binds — and a different TIER there, because that setter bare-assigns.
 */
const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };

/**
 * `item/<i>/shapes`: a FLAT array pairing each Shape3D with its Transform3D,
 * the form `_get_item_shapes` writes (mesh_library.cpp:355-364).
 *
 * The count is the one thing `_set_item_shapes` does not take as given. It
 * refuses nothing: an odd array gains a `Transform3D()` of its own where the
 * item is fresh — and a `BoxShape3D` where the last element is null — and loses
 * its last element where the item already holds shapes (:319-338). Either way
 * what is stored is not what was written, which is ADR-0032's error row.
 */
function shapePairs(): PropertyValidator {
  // `_set` forwards to `_set_item_shapes(int, const Array &)` (mesh_library.cpp:78,
  // :316), which takes an Array of any element type — so `Array[T]([…])` loads
  // here as readily as the bare literal Godot writes.
  const literal = v.arrayLiteral('shapes', { anyElementType: true });
  const validator: PropertyValidator = (key, value, line) => {
    const malformed = literal(key, value, line);
    if (malformed) return malformed;
    const elements = dropTrailingComma(splitTopLevel(arrayLiteralElements(value)));
    if (elements.length % 2 === 0) return null;
    return propertyError(
      key,
      line,
      `Property 'shapes' pairs every Shape3D with a Transform3D, so Godot only writes an even number of elements; it completes an odd one itself (mesh_library.cpp:319-338) rather than storing what is here (got ${elements.length})`,
      'INVALID_SHAPES_VALUE'
    );
  };
  validator.accepts = 'Array literal ([...]) of Shape3D, Transform3D pairs';
  // The `push_back(Transform3D())` arm; the other one resizes at :337.
  validator.grounding = { kind: 'enforced', cite: 'mesh_library.cpp:333' };
  return validator;
}

const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // mesh_library.cpp:146, Variant::STRING, no hint. set_item_name (:166-170)
  // assigns past a guard on the ITEM, never on the value.
  name: v.quotedString('name'),
  // :147, PROPERTY_HINT_RESOURCE_TYPE "Mesh". set_item_mesh (:172-176) assigns.
  mesh: v.resourceReference('mesh'),
  // :148, Variant::TRANSFORM3D. set_item_mesh_transform (:178-182) assigns.
  mesh_transform: v.transform3d('mesh_transform'),
  // :149, PROPERTY_HINT_ENUM "Off,On,Double-Sided,Shadows Only". An ERROR
  // rather than the hint warning GeometryInstance3D.cast_shadow carries for the
  // same constants: `_set`'s switch maps every other value to
  // SHADOW_CASTING_SETTING_ON (:66-68), so what was written is altered.
  mesh_cast_shadow: v.enumInt('mesh_cast_shadow', 0, 3, CAST_SHADOW, {
    enforced: 'mesh_library.cpp:66',
  }),
  // :150, Variant::ARRAY, no hint and no element type.
  shapes: shapePairs(),
  // :151, PROPERTY_HINT_RESOURCE_TYPE "NavigationMesh". :199-203 assigns.
  navigation_mesh: v.resourceReference('navigation_mesh'),
  // :152, Variant::TRANSFORM3D. :205-209 assigns.
  navigation_mesh_transform: v.transform3d('navigation_mesh_transform'),
  // :153, PROPERTY_HINT_LAYERS_3D_NAVIGATION over a uint32_t setter
  // (mesh_library.h:91) that bare-assigns (:211-215), so the hint is all there
  // is and it warns.
  navigation_layers: layerBitmask('navigation_layers', {
    hinted: 'mesh_library.cpp:153',
    width: 'uint32',
  }),
  // :154, PROPERTY_HINT_RESOURCE_TYPE "Texture2D". :217-221 assigns.
  preview: v.resourceReference('preview'),

  // Applied but never saved. `shape` wraps ONE Shape3D into a one-element shape
  // list (:71-76); `navmesh` and `navmesh_transform` were renamed in 4.0 beta 9
  // and still forward to the current setters (:87-90).
  shape: v.resourceReference('shape'),
  navmesh: v.resourceReference('navmesh'),
  navmesh_transform: v.transform3d('navmesh_transform'),
};

const itemValidator = indexedFamilyValidator({
  prefix: 'item/',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_MESHLIBRARY_ITEM_KEY',
  describes: 'item',
  // Parens rather than `<>`, which would open italics in the generated sheet's
  // table cell (lintCoverage.mjs:131).
  accepts:
    'item/(index)/(leaf) — name, mesh, mesh_transform, mesh_cast_shadow, shapes, navigation_mesh, navigation_mesh_transform, navigation_layers, preview',
  // `_set` reads the index with a bare `get_slicec('/', 1).to_int()` and no
  // validity gate (mesh_library.cpp:40), so `item/x/name` names item 0 and the
  // write lands.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'mesh_library.cpp:159',
    code: 'INVALID_MESHLIBRARY_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. MeshLibrary creates the item before writing to it and create_item refuses a negative id (mesh_library.cpp:159), so the value is never applied`,
  },
});

// The index follows a `/`, not glued to the prefix, so the plain wildcard is
// what `findOwnValidator` matches — `item#/*` addresses `item0/name`.
//
// The dispatcher already reads the leaf the way `_set` does: under
// `indexParse: 'to_int'` it cuts the remainder from the RIGHT until a declared
// leaf appears, which is `get_slicec('/', 2)` restated (mesh_library.cpp:40-41),
// so `item/0/name/extra` resolves to `name` and `item/0/bogus/extra` stays
// whole in the unknown-key message.
validatorRegistry.registerAll('MeshLibrary', { 'item/*': itemValidator });
