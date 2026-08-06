/**
 * NavigationAgent3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('NavigationAgent3D', property);
  expect(validator, `no validator registered for NavigationAgent3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key NavigationAgent3D binds via `ADD_PROPERTY`, across the
 * Pathfinding (navigation_agent_3d.cpp:154-168), Avoidance (:171-184) and
 * Debug (:203-206) groups. None carries `overrides=` in
 * doc/classes/NavigationAgent3D.xml, so all 33 get a validator here.
 */
const KEYS: string[] = [
  'target_position',
  'path_desired_distance',
  'target_desired_distance',
  'path_height_offset',
  'path_max_distance',
  'navigation_layers',
  'pathfinding_algorithm',
  'path_postprocessing',
  'path_metadata_flags',
  'simplify_path',
  'simplify_epsilon',
  'path_return_max_length',
  'path_return_max_radius',
  'path_search_max_polygons',
  'path_search_max_distance',
  'avoidance_enabled',
  'velocity',
  'height',
  'radius',
  'neighbor_distance',
  'max_neighbors',
  'time_horizon_agents',
  'time_horizon_obstacles',
  'max_speed',
  'use_3d_avoidance',
  'keep_y_velocity',
  'avoidance_layers',
  'avoidance_mask',
  'avoidance_priority',
  'debug_enabled',
  'debug_use_custom',
  'debug_path_custom_color',
  'debug_path_custom_point_size',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationAgent3D does NOT declare, each paired with the ancestor that does.
 * NavigationAgent3D's base is plain `Node` (nodeBaseTypes.generated.ts:146).
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node', 'process_mode'],
  ['Node', 'unique_name_in_owner'],
  ['Node', 'editor_description'],
];

describe('NavigationAgent3D strict validators', () => {
  it('registers exactly what NavigationAgent3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NavigationAgent3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-navigation-agent-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // NavigationAgent3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('NavigationAgent3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key NavigationAgent3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // NavigationAgent3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('NavigationAgent3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('NavigationAgent3D')).not.toContain(key);
    }
  });

  // --- Pathfinding ---

  describe('target_position', () => {
    it('accepts a Vector3 literal', () => {
      expect(check('target_position', 'Vector3(1, 2, 3)')).toBeNull();
    });
    it('rejects a malformed literal', () => {
      expect(check('target_position', 'Vector3(1, 2)')).not.toBeNull();
    });
    it('accepts the zero vector (edge)', () => {
      expect(check('target_position', 'Vector3(0, 0, 0)')).toBeNull();
    });
  });

  describe('path_desired_distance', () => {
    it('accepts a value above the floor', () => {
      expect(check('path_desired_distance', '5.0')).toBeNull();
    });
    it('warns below the hinted floor of 0.1 (bare assignment, cpp:591-597)', () => {
      const err = check('path_desired_distance', '0.05');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('path_desired_distance', '0.1')).toBeNull();
    });
  });

  describe('target_desired_distance', () => {
    it('accepts a value above the floor', () => {
      expect(check('target_desired_distance', '2.0')).toBeNull();
    });
    it('warns below the hinted floor of 0.1', () => {
      const err = check('target_desired_distance', '0');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('target_desired_distance', '0.1')).toBeNull();
    });
  });

  describe('path_height_offset', () => {
    it('accepts zero', () => {
      expect(check('path_height_offset', '0.0')).toBeNull();
    });
    it('warns below the hinted floor of -100 (pure bare assignment, cpp:626-628)', () => {
      const err = check('path_height_offset', '-101');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('path_height_offset', '-100')).toBeNull();
    });
  });

  describe('path_max_distance', () => {
    it('accepts a value above the floor', () => {
      expect(check('path_max_distance', '5.0')).toBeNull();
    });
    it('warns below the hinted floor of 0.01 (bare assignment, cpp:693-699)', () => {
      const err = check('path_max_distance', '0.001');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('path_max_distance', '0.01')).toBeNull();
    });
  });

  describe('navigation_layers', () => {
    it('accepts a layer bitmask', () => {
      expect(check('navigation_layers', '4')).toBeNull();
    });
    it('warns on a negative mask (only the 32-checkbox widget bounds it)', () => {
      const err = check('navigation_layers', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts the widest 32-bit mask (edge)', () => {
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });
  });

  describe('pathfinding_algorithm', () => {
    it('accepts the only algorithm, AStar (0)', () => {
      expect(check('pathfinding_algorithm', '0')).toBeNull();
    });
    it('warns on any other value (bare assignment, hint lists one member)', () => {
      const err = check('pathfinding_algorithm', '1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
  });

  describe('path_postprocessing', () => {
    it('accepts EDGECENTERED (1)', () => {
      expect(check('path_postprocessing', '1')).toBeNull();
    });
    it('warns above the enum ceiling', () => {
      const err = check('path_postprocessing', '3');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts the ceiling, NONE (2) (edge)', () => {
      expect(check('path_postprocessing', '2')).toBeNull();
    });
  });

  describe('path_metadata_flags', () => {
    it('accepts every hinted bit combined (1|2|4=7)', () => {
      expect(check('path_metadata_flags', '7')).toBeNull();
    });
    it('warns on a bit outside the hinted 3 (bare assignment keeps it, cpp:561-567)', () => {
      const err = check('path_metadata_flags', '8');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts zero, no flags (edge)', () => {
      expect(check('path_metadata_flags', '0')).toBeNull();
    });
  });

  describe('simplify_path', () => {
    it('accepts true and false', () => {
      expect(check('simplify_path', 'true')).toBeNull();
      expect(check('simplify_path', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('simplify_path', 'yes')).not.toBeNull();
    });
  });

  describe('simplify_epsilon', () => {
    it('accepts a positive value', () => {
      expect(check('simplify_epsilon', '1.0')).toBeNull();
    });
    it('errors on negative (setter clamps: MAX(0.0, p_epsilon), cpp:513)', () => {
      const err = check('simplify_epsilon', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('simplify_epsilon', '0')).toBeNull();
    });
  });

  describe('path_return_max_length', () => {
    it('accepts a positive value', () => {
      expect(check('path_return_max_length', '50.0')).toBeNull();
    });
    it('errors on negative (setter clamps: MAX(0.0, p_length), cpp:522)', () => {
      const err = check('path_return_max_length', '-0.01');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('path_return_max_length', '0')).toBeNull();
    });
  });

  describe('path_return_max_radius', () => {
    it('accepts a positive value', () => {
      expect(check('path_return_max_radius', '25.0')).toBeNull();
    });
    it('errors on negative (setter clamps: MAX(0.0, p_radius), cpp:531)', () => {
      const err = check('path_return_max_radius', '-5');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('path_return_max_radius', '0')).toBeNull();
    });
  });

  describe('path_search_max_polygons', () => {
    it('accepts a positive count', () => {
      expect(check('path_search_max_polygons', '2048')).toBeNull();
    });
    it('warns on negative (bare assignment, hint floor is advisory)', () => {
      const err = check('path_search_max_polygons', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly zero, meaning unlimited (edge)', () => {
      expect(check('path_search_max_polygons', '0')).toBeNull();
    });
  });

  describe('path_search_max_distance', () => {
    it('accepts a positive value', () => {
      expect(check('path_search_max_distance', '10.0')).toBeNull();
    });
    it('errors on negative (setter clamps: MAX(0.0, p_distance), cpp:549; no hint at all)', () => {
      const err = check('path_search_max_distance', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero, meaning unlimited (edge)', () => {
      expect(check('path_search_max_distance', '0')).toBeNull();
    });
  });

  // --- Avoidance ---

  describe('avoidance_enabled', () => {
    it('accepts true and false', () => {
      expect(check('avoidance_enabled', 'true')).toBeNull();
      expect(check('avoidance_enabled', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('avoidance_enabled', '1')).not.toBeNull();
    });
  });

  describe('velocity', () => {
    it('accepts a Vector3 literal', () => {
      expect(check('velocity', 'Vector3(1, 0, 0)')).toBeNull();
    });
    it('rejects a malformed literal', () => {
      expect(check('velocity', 'not-a-vector')).not.toBeNull();
    });
    it('accepts the zero vector (edge)', () => {
      expect(check('velocity', 'Vector3(0, 0, 0)')).toBeNull();
    });
  });

  describe('height', () => {
    it('accepts a positive value', () => {
      expect(check('height', '2.0')).toBeNull();
    });
    it('errors on negative (ERR_FAIL_COND_MSG(p_height < 0.0, ...), cpp:618)', () => {
      const err = check('height', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('height', '0')).toBeNull();
    });
  });

  describe('radius', () => {
    it('accepts a positive value', () => {
      expect(check('radius', '0.75')).toBeNull();
    });
    it('errors on negative (ERR_FAIL_COND_MSG(p_radius < 0.0, ...), cpp:608)', () => {
      const err = check('radius', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('radius', '0')).toBeNull();
    });
  });

  describe('neighbor_distance', () => {
    it('accepts a value above the floor', () => {
      expect(check('neighbor_distance', '50.0')).toBeNull();
    });
    it('warns below the hinted floor of 0.1', () => {
      const err = check('neighbor_distance', '0');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('neighbor_distance', '0.1')).toBeNull();
    });
  });

  describe('max_neighbors', () => {
    it('accepts a positive count', () => {
      expect(check('max_neighbors', '10')).toBeNull();
    });
    it('warns below the hinted floor of 1 (bare assignment, cpp:655-663)', () => {
      const err = check('max_neighbors', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts exactly the floor (edge)', () => {
      expect(check('max_neighbors', '1')).toBeNull();
    });
  });

  describe('time_horizon_agents', () => {
    it('accepts a positive value', () => {
      expect(check('time_horizon_agents', '1.5')).toBeNull();
    });
    it('errors on negative (ERR_FAIL_COND_MSG(p_time_horizon < 0.0, ...), cpp:666)', () => {
      const err = check('time_horizon_agents', '-0.1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('time_horizon_agents', '0')).toBeNull();
    });
  });

  describe('time_horizon_obstacles', () => {
    it('accepts a positive value', () => {
      expect(check('time_horizon_obstacles', '0.5')).toBeNull();
    });
    it('errors on negative (ERR_FAIL_COND_MSG(p_time_horizon < 0.0, ...), cpp:675)', () => {
      const err = check('time_horizon_obstacles', '-0.1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('time_horizon_obstacles', '0')).toBeNull();
    });
  });

  describe('max_speed', () => {
    it('accepts a positive value', () => {
      expect(check('max_speed', '5.0')).toBeNull();
    });
    it('errors on negative (ERR_FAIL_COND_MSG(p_max_speed < 0.0, ...), cpp:684)', () => {
      const err = check('max_speed', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('max_speed', '0')).toBeNull();
    });
  });

  describe('use_3d_avoidance', () => {
    it('accepts true and false', () => {
      expect(check('use_3d_avoidance', 'true')).toBeNull();
      expect(check('use_3d_avoidance', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('use_3d_avoidance', '1')).not.toBeNull();
    });
  });

  describe('keep_y_velocity', () => {
    it('accepts true and false', () => {
      expect(check('keep_y_velocity', 'true')).toBeNull();
      expect(check('keep_y_velocity', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('keep_y_velocity', '0')).not.toBeNull();
    });
  });

  describe('avoidance_layers', () => {
    it('accepts a layer bitmask', () => {
      expect(check('avoidance_layers', '2')).toBeNull();
    });
    it('warns on a negative mask', () => {
      const err = check('avoidance_layers', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts the widest 32-bit mask (edge)', () => {
      expect(check('avoidance_layers', '4294967295')).toBeNull();
    });
  });

  describe('avoidance_mask', () => {
    it('accepts a mask bitmask', () => {
      expect(check('avoidance_mask', '3')).toBeNull();
    });
    it('warns on a negative mask', () => {
      const err = check('avoidance_mask', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
    it('accepts the widest 32-bit mask (edge)', () => {
      expect(check('avoidance_mask', '4294967295')).toBeNull();
    });
  });

  describe('avoidance_priority', () => {
    it('accepts a mid-range value', () => {
      expect(check('avoidance_priority', '0.5')).toBeNull();
    });
    it('errors below 0 (ERR_FAIL_COND_MSG(p_priority < 0.0, ...), cpp:1058)', () => {
      const err = check('avoidance_priority', '-0.1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('errors above 1 (ERR_FAIL_COND_MSG(p_priority > 1.0, ...), cpp:1059)', () => {
      const err = check('avoidance_priority', '1.1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts both inclusive ends (edge)', () => {
      expect(check('avoidance_priority', '0')).toBeNull();
      expect(check('avoidance_priority', '1')).toBeNull();
    });
  });

  // --- Debug ---

  describe('debug_enabled', () => {
    it('accepts true and false', () => {
      expect(check('debug_enabled', 'true')).toBeNull();
      expect(check('debug_enabled', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('debug_enabled', '0')).not.toBeNull();
    });
  });

  describe('debug_use_custom', () => {
    it('accepts true and false', () => {
      expect(check('debug_use_custom', 'true')).toBeNull();
      expect(check('debug_use_custom', 'false')).toBeNull();
    });
    it('rejects a non-boolean token', () => {
      expect(check('debug_use_custom', 'maybe')).not.toBeNull();
    });
  });

  describe('debug_path_custom_color', () => {
    it('accepts a Color literal', () => {
      expect(check('debug_path_custom_color', 'Color(1, 0, 0, 1)')).toBeNull();
    });
    it('rejects a malformed literal', () => {
      expect(check('debug_path_custom_color', 'Color(1, 0, 0)')).not.toBeNull();
    });
    it('accepts transparent black (edge)', () => {
      expect(check('debug_path_custom_color', 'Color(0, 0, 0, 0)')).toBeNull();
    });
  });

  describe('debug_path_custom_point_size', () => {
    it('accepts a positive value', () => {
      expect(check('debug_path_custom_point_size', '5.0')).toBeNull();
    });
    it('errors on negative (setter clamps under DEBUG_ENABLED: MAX(0.0, p_point_size), cpp:1121)', () => {
      const err = check('debug_path_custom_point_size', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
    it('accepts exactly zero (edge)', () => {
      expect(check('debug_path_custom_point_size', '0')).toBeNull();
    });
  });
});
