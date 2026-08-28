/**
 * The `Resource` base validators, and the reach that makes them worth having.
 *
 * Driven through the full barrel rather than the module, because the claim is
 * not "these two validators work" but "every resource in a scene gets them",
 * and that depends on the barrel importing this file and on the resource
 * base-walk arriving here from whatever type the scene names.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import { runResourcePropertyValidation } from '../../linter/testing/testkit.js';
import '../../linter/index';

runResourcePropertyValidation('StandardMaterial3D', [
  {
    prop: 'resource_name',
    valid: ['"Rusty metal"', '""'],
    invalid: [{ value: 'Rusty metal', contains: ['resource_name'], severity: 'error' }],
  },
  {
    prop: 'resource_local_to_scene',
    valid: ['true', 'false'],
    invalid: [{ value: '1', contains: ['resource_local_to_scene'], severity: 'warning' }],
  },
]);

describe('Resource base validators', () => {
  it('reaches a resource type that registers nothing of its own', () => {
    // Three hops up from a leaf whose own slice is only a decoder. Any
    // Resource class would do; this one is in the corpus.
    expect(validatorRegistry.findValidator('QuadMesh', 'resource_name')).not.toBeNull();
    expect(validatorRegistry.findValidator('Animation', 'resource_local_to_scene')).not.toBeNull();
  });

  it('declares nothing the engine does not serialise', () => {
    // `resource_path` is EDITOR-only and `resource_scene_unique_id` is
    // PROPERTY_USAGE_NONE (resource.cpp:763, :765): neither reaches a `.tscn`,
    // so a validator for either would reject a key no scene can contain.
    expect(validatorRegistry.getOwnKeys('Resource').sort()).toEqual([
      'resource_local_to_scene',
      'resource_name',
    ]);
  });
});
