/**
 * ResourcePreloader strict validators for linting.
 *
 * ResourcePreloader has exactly one `ADD_PROPERTY`, `resources`
 * (resource_preloader.cpp:147) — but its usage is
 * `PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_INTERNAL`, which is
 * `PROPERTY_USAGE_STORAGE | PROPERTY_USAGE_INTERNAL` (object.h:132 aliases
 * NO_EDITOR to STORAGE alone). `PackedScene`'s node-property save loop
 * (packed_scene.cpp:108) tests only `PROPERTY_USAGE_STORAGE`, so this key DOES
 * reach a `.tscn` despite being invisible in the inspector; it is not
 * `PROPERTY_USAGE_NONE`, so rule #3 (ADD_PROPERTY governs serialisation, not
 * PROPERTY_USAGE_NO_EDITOR) applies rather than the "no validator" case.
 *
 * The getter/setter are `_get_resources`/`_set_resources`
 * (resource_preloader.cpp:33-49, :51-71), which is XML's `<members>`-invisible
 * because doc/classes/ResourcePreloader.xml has none — the class is documented
 * entirely through its public methods (add_resource/get_resource/…), and
 * `resources` is the private wire format behind them.
 *
 * `_get_resources` builds `Array{ names, arr }`: an UNTYPED 2-element Array
 * (PackedStringArray of names, plain Array of resource refs), so its Godot
 * text-format serialisation (variant_parser.cpp:2338, no `Array[T](` wrapper
 * for an untyped Array, and the ARRAY branch joins elements with `", "` rather
 * than the DICTIONARY branch's `,\n` — so the whole property is one line, and
 * `StrictTscnParser`'s `isMultiline` skip never hides it) is
 * `[PackedStringArray(...), [...]]`. `_set_resources` enforces three things
 * about it, in order: a top-level 2-element shape, the two inner arrays being
 * the same length, and no null resource — each is grounded below.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError } from '../../../linter/validators/index.js';
import { ARRAY_LITERAL_RE, RESOURCE_REF_RE, packedArrayLiteral } from '../../../godot/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string.js';

const OUTER_RE = ARRAY_LITERAL_RE;
const PACKED_STRING_ARRAY_RE = packedArrayLiteral('PackedStringArray');
const QUOTED_NAME_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;
const FORMAT_CODE = 'INVALID_RESOURCES_FORMAT';

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
    // resource_preloader.cpp:36, ERR_FAIL_COND(p_data.size() != 2) — the whole
    // write is dropped, resources cleared.
    return propertyError(
      key,
      line,
      `Property 'resources' must have exactly 2 top-level elements (names, resources), got ${topParts.length}`,
      'INVALID_RESOURCES_SHAPE'
    );
  }

  // Godot's own writer only ever emits PackedStringArray(...) here, but
  // `Vector<String> names = p_data[0]` (resource_preloader.cpp:37) is a
  // `Variant::operator PackedStringArray()`, which falls back to
  // `_convert_array_from_variant` for ANY other Variant::ARRAY
  // (variant.cpp:2183-2189) — so a hand-written bare `["a", "b"]` loads too.
  // Accepting only the canonical spelling would reject a value the engine
  // itself converts.
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

  // A trailing comma is legal only in the bare `[…]` spelling: `_parse_array`
  // closes on `TK_BRACKET_CLOSE` before it demands another value
  // (variant_parser.cpp:1658-1662), while `_parse_construct` (:551-596) demands
  // one after every comma, so `PackedStringArray("a", "b",)` really is a format
  // error and keeps its empty element.
  const rawNames = splitTopLevel(namesMatch[1]!);
  const names = packedNames ? rawNames : dropTrailingComma(rawNames);
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
    // resource_preloader.cpp:40, ERR_FAIL_COND(names.size() != resdata.size())
    // — the whole write is dropped, resources cleared.
    return propertyError(
      key,
      line,
      `Property 'resources' has ${names.length} name(s) but ${entries.length} resource(s); Godot drops the whole property when they differ`,
      'INVALID_RESOURCES_COUNT_MISMATCH'
    );
  }

  for (const entry of entries) {
    if (!RESOURCE_REF_RE.test(entry)) {
      // resource_preloader.cpp:44, ERR_CONTINUE(resource.is_null()) — a
      // non-resource (including the literal `null`) drops that one pair
      // silently rather than the whole property.
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
