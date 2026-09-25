/**
 * MeshLibrary's `item/<i>/<leaf>` family: the only properties the class
 * serialises, and all nine of them built by hand in `_get_property_list`
 * (mesh_library.cpp:143-156) rather than declared with `ADD_PROPERTY`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import { lint, scene, subResource } from '../../linter/testing/testkit';
import './linterValidators';

const find = (key: string) => validatorRegistry.findValidator('MeshLibrary', key);

/** Run the registered validator for `key`, or fail loudly when none resolves. */
function check(key: string, value: string) {
  const validator = find(key);
  expect(validator, `no validator for ${key}`).not.toBeNull();
  return validator!(key, value, 1);
}

describe('MeshLibrary item family', () => {
  it('covers every leaf `_get_property_list` writes (mesh_library.cpp:146-154)', () => {
    const serialised = [
      'name',
      'mesh',
      'mesh_transform',
      'mesh_cast_shadow',
      'shapes',
      'navigation_mesh',
      'navigation_mesh_transform',
      'navigation_layers',
      'preview',
    ];
    for (const leaf of serialised) {
      expect(find(`item/0/${leaf}`), leaf).not.toBeNull();
    }
  });

  it('takes the values Godot writes for each leaf', () => {
    expect(check('item/0/name', '"Floor"')).toBeNull();
    expect(check('item/0/mesh', 'ExtResource("8_floor")')).toBeNull();
    expect(
      check('item/0/mesh_transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')
    ).toBeNull();
    expect(check('item/0/mesh_cast_shadow', '2')).toBeNull();
    expect(check('item/0/shapes', '[]')).toBeNull();
    expect(check('item/0/navigation_mesh', 'SubResource("NavigationMesh_a")')).toBeNull();
    expect(
      check('item/0/navigation_mesh_transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')
    ).toBeNull();
    expect(check('item/0/navigation_layers', '5')).toBeNull();
    expect(check('item/0/preview', 'ExtResource("1_icon")')).toBeNull();
  });

  it('rejects a value the leaf cannot hold', () => {
    expect(check('item/0/name', 'Floor')?.severity).toBe('error');
    expect(check('item/0/mesh', '"res://floor.tres"')?.severity).toBe('error');
    expect(check('item/0/mesh_transform', 'Transform3D(1, 0, 0)')?.severity).toBe('error');
    expect(check('item/0/shapes', '5')?.severity).toBe('error');
    expect(check('item/0/navigation_layers', 'all')?.severity).toBe('error');
  });

  /**
   * `_set`'s own switch maps every other integer to
   * `SHADOW_CASTING_SETTING_ON` (mesh_library.cpp:66-68), so the written value
   * is silently altered: ADR-0032's error row, not the warning
   * `GeometryInstance3D.cast_shadow` carries for the same four constants.
   */
  it('errors on a mesh_cast_shadow Godot rewrites to ON', () => {
    const out = check('item/0/mesh_cast_shadow', '4');
    expect(out?.severity).toBe('error');
    expect(out?.message).toContain('SHADOWS_ONLY');
    expect(check('item/0/mesh_cast_shadow', '-1')?.severity).toBe('error');
  });

  /**
   * `shapes` pairs each Shape3D with its Transform3D (`_get_item_shapes`,
   * mesh_library.cpp:355-364), so Godot writes an even count. `_set_item_shapes`
   * completes an odd one: it appends a Transform3D to a fresh item and drops the
   * last element otherwise (:319-338).
   */
  it('errors on an odd shapes count, which Godot completes rather than stores', () => {
    const identity = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
    expect(check('item/0/shapes', `[SubResource("BoxShape3D_a"), ${identity}]`)).toBeNull();

    const out = check('item/0/shapes', '[SubResource("BoxShape3D_a")]');
    expect(out?.severity).toBe('error');
    expect(out?.message).toContain('pairs');
  });

  /**
   * `_set` forwards to `_set_item_shapes(int, const Array &)`
   * (mesh_library.cpp:78, :316), which takes an Array of any element type, so
   * the typed spelling loads, and refusing it rejects a file Godot opens. What
   * `_get_item_shapes` writes is a write-side fact and bounds nothing here.
   */
  it('takes the typed Array spelling, and counts pairs inside the wrapper', () => {
    const identity = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
    expect(
      check('item/0/shapes', `Array[Variant]([SubResource("BoxShape3D_a"), ${identity}])`)
    ).toBeNull();
    expect(check('item/0/shapes', 'Array[Variant]([])')).toBeNull();

    // Counted off the WRAPPED body: `slice(1, -1)` would read
    // `rray[Variant]([SubResource("BoxShape3D_a")]` and see one element too.
    const out = check('item/0/shapes', 'Array[Variant]([SubResource("BoxShape3D_a")])');
    expect(out?.severity).toBe('error');
    expect(out?.message).toContain('got 1');
  });

  /**
   * `navigation_layers` is a `PROPERTY_HINT_LAYERS_3D_NAVIGATION`
   * (mesh_library.cpp:153) over a `uint32_t` setter (mesh_library.h:91) that
   * bare-assigns (:211-215). Thirty-two checkboxes express every 32-bit
   * pattern, so both spellings of "all layers" are legal.
   */
  it('bounds navigation_layers to no fewer than the 32 bits it holds', () => {
    expect(check('item/0/navigation_layers', '4294967295')).toBeNull();
    expect(check('item/0/navigation_layers', '-1')).toBeNull();
  });

  /**
   * Keys `_set` applies but `_get_property_list` never writes, so reporting one
   * claims a drop the engine does not make. `shape` wraps one Shape3D into a
   * one-element list (:71-76). The `navmesh*` spellings, renamed in 4.0 beta 9,
   * forward to the current setters (:87-90).
   */
  it('accepts the keys Godot loads but never saves', () => {
    expect(check('item/0/shape', 'SubResource("BoxShape3D_a")')).toBeNull();
    expect(check('item/0/navmesh', 'SubResource("NavigationMesh_a")')).toBeNull();
    expect(
      check('item/0/navmesh_transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')
    ).toBeNull();
  });

  it('reports a leaf `_set` does not recognise, which returns false (:94-95)', () => {
    const out = check('item/0/bogus', '"x"');
    expect(out?.severity).toBe('error');
    expect(out?.message).toContain('item/0/bogus');
  });

  /**
   * `create_item`'s `ERR_FAIL_COND(p_item < 0)` (mesh_library.cpp:159) leaves no
   * item, so the `set_item_*` that follows fails its own guard and the write
   * never lands.
   */
  it('reports a negative item index', () => {
    expect(check('item/-1/name', '"Floor"')?.message).toContain('-1');
  });

  /**
   * The index is read with a bare `get_slicec('/', 1).to_int()` and no validity
   * gate (mesh_library.cpp:40), and `to_int` skips a character it cannot use
   * (ustring.cpp:2280-2293), so `x` names item 0 and `a-1` names item -1.
   */
  it('resolves a non-numeric index the way to_int does', () => {
    expect(check('item/x/name', '"Floor"')).toBeNull();
    expect(check('item/+7/name', '"Floor"')).toBeNull();
    expect(check('item/a-1/name', '"Floor"')?.message).toContain('-1');
  });

  /**
   * `_set` reads fixed slices, `get_slicec('/', 1)` for the index and
   * `get_slicec('/', 2)` for the leaf (mesh_library.cpp:40-41), and `get_slicec`
   * returns that slice alone (ustring.cpp:941-964). So `item/0/name/extra` sets
   * item 0's name, and only the value is left to judge.
   */
  it('reads the leaf as a fixed slice, so a trailing segment still names it', () => {
    expect(check('item/0/name/extra', '"Floor"')).toBeNull();

    const key = 'item/0/mesh_transform/extra';
    const out = check(key, 'Transform3D(1, 0, 0)');
    expect(out?.message).toContain("Property 'mesh_transform'");
    // The column is the value's own position, which the trailing segment moves.
    expect(out?.column).toBe(key.length + 3);
  });

  /**
   * A fence against the obvious implementation of the leniency above: trimming
   * every key to its first three segments would report `item/0/bogus`, a key
   * the file does not carry and nobody can grep for.
   */
  it('names the key the file carries when slice 2 is no leaf at all', () => {
    expect(check('item/0/bogus/extra', '"x"')?.message).toContain('item/0/bogus/extra');
  });

  /**
   * The other seam: a `[sub_resource type="MeshLibrary"]` block reaches these
   * validators through `StrictTscnParser`'s own `findValidator` call, which is
   * a different claim from the registry answering when asked directly.
   */
  it('reaches an embedded MeshLibrary block through the scanning loop', () => {
    const identity = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
    expect(
      lint(
        scene(
          subResource('MeshLibrary', {
            'item/0/name': '"Floor"',
            'item/0/mesh_transform': identity,
          })
        )
      )
    ).toHaveLength(0);

    const diagnostics = lint(
      scene(subResource('MeshLibrary', { 'item/0/mesh_cast_shadow': 9 }))
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('mesh_cast_shadow');
  });
});
