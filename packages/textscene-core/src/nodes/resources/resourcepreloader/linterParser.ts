/**
 * ResourcePreloader strict validators for its one `ADD_PROPERTY`, `resources`
 * (resource_preloader.cpp:147). NO_EDITOR is STORAGE (object.h:132), and the save
 * loop tests only STORAGE (packed_scene.cpp:108), so the key reaches a `.tscn`
 * though doc/classes/ResourcePreloader.xml lists no member.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError } from '../../../linter/validators/index.js';
import { ARRAY_LITERAL_RE, packedArrayLiteral, resourceRef } from '../../../godot/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string.js';

const OUTER_RE = ARRAY_LITERAL_RE;
const PACKED_STRING_ARRAY_RE = packedArrayLiteral('PackedStringArray');
const QUOTED_NAME_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;
const FORMAT_CODE = 'INVALID_RESOURCES_FORMAT';

/**
 * `_get_resources` (resource_preloader.cpp:33-49) builds an untyped 2-element Array,
 * written on one line as `[PackedStringArray(...), [...]]` (variant_parser.cpp:2338),
 * so `isMultiline` never skips it. `_set_resources` (:51-71) checks the shape, the
 * equal lengths and each resource, in that order.
 */
const resourcesValidator: PropertyValidator = accepts((key, value, line) => {
  const trimmed = value.trim();
  const outer = OUTER_RE.exec(trimmed);
  if (!outer) {
    return propertyError(
      key,
      line,
      `Property 'resources' must be [PackedStringArray(names...), [resource refs...]], got: "${value}"`,
      FORMAT_CODE
    );
  }

  const topParts = dropTrailingComma(splitTopLevel(outer[1]!));
  if (topParts.length !== 2) {
    // resource_preloader.cpp:36, ERR_FAIL_COND(p_data.size() != 2): the whole
    // write is dropped, resources cleared.
    return propertyError(
      key,
      line,
      `Property 'resources' must have exactly 2 top-level elements (names, resources), got ${topParts.length}`,
      'INVALID_RESOURCES_SHAPE'
    );
  }

  // Godot writes PackedStringArray(...) here, but `names = p_data[0]`
  // (resource_preloader.cpp:37) converts any other Variant::ARRAY
  // (variant.cpp:2183-2189), so a hand-written bare `["a", "b"]` loads too.
  const packedNames = PACKED_STRING_ARRAY_RE.exec(topParts[0]!);
  const namesMatch = packedNames ?? OUTER_RE.exec(topParts[0]!);
  if (!namesMatch) {
    return propertyError(
      key,
      line,
      `Property 'resources' element 0 must be PackedStringArray(...) or an Array of strings, got: "${topParts[0]}"`,
      FORMAT_CODE
    );
  }
  const resourcesMatch = OUTER_RE.exec(topParts[1]!);
  if (!resourcesMatch) {
    return propertyError(
      key,
      line,
      `Property 'resources' element 1 must be an Array of resource references, got: "${topParts[1]}"`,
      FORMAT_CODE
    );
  }

  // A trailing comma closes both spellings: `_parse_array` closes on
  // `TK_BRACKET_CLOSE` first (variant_parser.cpp:1658-1662), and the
  // PackedStringArray reader's close is ungated (:1524-1525), unlike
  // `_parse_construct`'s `first &&` at :575.
  const names = dropTrailingComma(splitTopLevel(namesMatch[1]!));
  for (const name of names) {
    if (!QUOTED_NAME_RE.test(name)) {
      return propertyError(
        key,
        line,
        `Property 'resources' name "${name}" must be a quoted string`,
        FORMAT_CODE
      );
    }
  }

  const entries = dropTrailingComma(splitTopLevel(resourcesMatch[1]!));
  if (names.length !== entries.length) {
    // resource_preloader.cpp:40, ERR_FAIL_COND(names.size() != resdata.size()):
    // the whole write is dropped, resources cleared.
    return propertyError(
      key,
      line,
      `Property 'resources' has ${names.length} name(s) but ${entries.length} resource(s); Godot drops the whole property when they differ`,
      'INVALID_RESOURCES_COUNT_MISMATCH'
    );
  }

  for (const entry of entries) {
    if (resourceRef(entry) === null) {
      // resource_preloader.cpp:44, ERR_CONTINUE(resource.is_null()): a
      // non-resource, the literal `null` included, drops only that pair.
      return propertyError(
        key,
        line,
        `Property 'resources' entry "${entry}" must be SubResource(...) or ExtResource(...); Godot drops a null/non-resource entry`,
        'INVALID_RESOURCES_ENTRY'
      );
    }
  }

  return null;
}, '[PackedStringArray(names...), [SubResource/ExtResource, …]] with matching, non-null entries');
resourcesValidator.grounding = {
  kind: 'enforced',
  cite: 'resource_preloader.cpp:36, resource_preloader.cpp:40, resource_preloader.cpp:44',
};

validatorRegistry.registerAll('ResourcePreloader', {
  resources: resourcesValidator,
});
