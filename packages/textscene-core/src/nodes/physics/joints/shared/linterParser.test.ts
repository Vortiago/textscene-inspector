/**
 * The joint tiers, and the one thing that makes them two tiers rather than one:
 * Godot gives 2D and 3D joints different property names for the same idea, so a
 * merged tier would accept keys the dimension cannot carry.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

const KEYS_2D = ['node_a', 'node_b', 'bias', 'disable_collision'] as const;
const KEYS_3D = ['node_a', 'node_b', 'solver_priority', 'exclude_nodes_from_collision'] as const;

describe('Joint shared validators', () => {
  it('registers exactly what joint_2d.cpp and joint_3d.cpp bind', () => {
    expect(validatorRegistry.getOwnKeys('Joint2D').sort()).toEqual([...KEYS_2D].sort());
    expect(validatorRegistry.getOwnKeys('Joint3D').sort()).toEqual([...KEYS_3D].sort());
  });

  it('keeps the two dimensions apart, despite the shared setter', () => {
    // `disable_collision` and `exclude_nodes_from_collision` are the same C++
    // setter under two names; each dimension serialises only its own.
    expect(validatorRegistry.findValidator('Joint2D', 'exclude_nodes_from_collision')).toBeNull();
    expect(validatorRegistry.findValidator('Joint3D', 'disable_collision')).toBeNull();
    expect(validatorRegistry.findValidator('Joint2D', 'solver_priority')).toBeNull();
    expect(validatorRegistry.findValidator('Joint3D', 'bias')).toBeNull();
  });

  it('bounds bias to the 2D hint, which has no or_greater', () => {
    const bias = validatorRegistry.findValidator('Joint2D', 'bias')!;
    for (const ok of ['0', '0.45', '0.9']) expect(bias('bias', ok, 1)).toBeNull();
    expect(bias('bias', '1.0', 1)).not.toBeNull();
    expect(bias('bias', '-0.1', 1)).not.toBeNull();
  });

  it('bounds solver_priority to 1-8, so 0 is rejected rather than treated as a default', () => {
    const priority = validatorRegistry.findValidator('Joint3D', 'solver_priority')!;
    for (const ok of ['1', '4', '8']) expect(priority('solver_priority', ok, 1)).toBeNull();
    expect(priority('solver_priority', '0', 1)).not.toBeNull();
    expect(priority('solver_priority', '9', 1)).not.toBeNull();
  });

  it.each(['node_a', 'node_b'])('takes a NodePath for %s and rejects a bare string', (key) => {
    const validator = validatorRegistry.findValidator('Joint3D', key)!;
    expect(validator(key, 'NodePath("../BodyA")', 1)).toBeNull();
    expect(validator(key, '"../BodyA"', 1)).not.toBeNull();
  });
});
