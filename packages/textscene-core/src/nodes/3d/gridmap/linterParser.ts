/**
 * GridMap strict validators for linting (format validation).
 *
 * `data` and `baked_meshes` are a hand-rolled `_set`/`_get`/`_get_property_list`
 * route (grid_map.cpp:61-158), zero `ADD_PROPERTY`, zero XML `<member>`. See
 * propertyListRouteCoverage.test.ts.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, RESOURCE_REFERENCE_REGEX, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { splitTopLevel } from '../../../godot/string.js';

const DICT_LITERAL_RE = /^\{[\s\S]*\}$/;
const CELLS_RE = /"cells"\s*:\s*PackedInt32Array\(([\s\S]*?)\)/;

/**
 * `data`: a packed cell Dictionary, `{ "cells": PackedInt32Array(key_lo,
 * key_hi, cell, …) }` (grid_map.cpp:64-80 `_set`, :117-137 `_get`, :158
 * `_get_property_list`). `d.has("cells")` (:67) guards the whole branch, so a
 * Dictionary without that key is accepted untouched — GridMap's own writer
 * always includes it, but nothing refuses its absence.
 *
 * `ERR_FAIL_COND_V(amount % 3, false)` (:71) is a REAL enforced whole-value
 * bound: a malformed length drops the entire write (`cell_map` is left as it
 * was, not partially updated).
 */
const dataValidator: PropertyValidator = accepts((key, value, line) => {
  const trimmed = value.trim();
  if (!DICT_LITERAL_RE.test(trimmed)) {
    return propertyError(
      key,
      line,
      `Property 'data' must be a Dictionary literal like { "cells": PackedInt32Array(...) }, got: ${value}`,
      'INVALID_DATA_FORMAT'
    );
  }
  const cellsMatch = CELLS_RE.exec(trimmed);
  if (!cellsMatch) return null; // no "cells" key: grid_map.cpp:67 skips processing entirely.
  const body = cellsMatch[1]!.trim();
  const count = body === '' ? 0 : splitTopLevel(body).length;
  if (count % 3 !== 0) {
    return propertyError(
      key,
      line,
      `Property 'data' cells must be a flat list of (key_lo, key_hi, cell) triples; got ${count} int(s), not a multiple of 3 (grid_map.cpp:71)`,
      'INVALID_DATA_CELLS_COUNT'
    );
  }
  return null;
}, 'Dictionary literal { "cells": PackedInt32Array(...) }');
dataValidator.grounding = { kind: 'enforced', cite: 'grid_map.cpp:71' };

const ARRAY_LITERAL_RE = /^\[([\s\S]*)\]$/;

/**
 * `baked_meshes`: an Array of baked ArrayMesh resources (grid_map.cpp:84-106
 * `_set`, :138-145 `_get`, :154-156 `_get_property_list`, conditionally pushed
 * only while `baked_meshes.size() > 0`). `ERR_CONTINUE(bm.mesh.is_null())`
 * (:97) silently drops a null entry rather than failing the whole write, which
 * is still ADR-0032's error tier (the setter alters the value — the array
 * shrinks by one, shifting every later mesh's index) — so a null entry is
 * rejected here.
 */
const bakedMeshesValidator: PropertyValidator = accepts((key, value, line) => {
  const match = ARRAY_LITERAL_RE.exec(value.trim());
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'baked_meshes' must be an Array literal of resource references like [SubResource("id")], got: ${value}`,
      'INVALID_BAKED_MESHES_FORMAT'
    );
  }
  const body = match[1]!.trim();
  if (body === '') return null;
  for (const entry of splitTopLevel(body)) {
    if (!RESOURCE_REFERENCE_REGEX.test(entry)) {
      return propertyError(
        key,
        line,
        `Property 'baked_meshes' entry "${entry}" must be SubResource(...) or ExtResource(...); grid_map.cpp:97 drops a null mesh silently, shifting every later index`,
        'INVALID_BAKED_MESHES_ENTRY'
      );
    }
  }
  return null;
}, 'Array of resource references ([SubResource("id"), …])');
bakedMeshesValidator.grounding = { kind: 'enforced', cite: 'grid_map.cpp:97' };

validatorRegistry.registerAll('GridMap', {
  mesh_library: v.resourceReference('mesh_library'),
  cell_size: v.vector3('cell_size'),
  cell_center_x: v.boolean('cell_center_x'),
  cell_center_y: v.boolean('cell_center_y'),
  cell_center_z: v.boolean('cell_center_z'),
  data: dataValidator,
  baked_meshes: bakedMeshesValidator,
});
