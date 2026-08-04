/**
 * NavigationAgent3D strict validator coverage — the avoidance/path property
 * surface. NavigationAgent3D is a plain Node (see nodeBaseTypes.ts), so there
 * are no spatial validators to exercise here.
 */

import { describe, it } from 'vitest';
import './linterParser';
import { expectDiagnostic, expectNoErrors, node, scene } from '../../../linter/testing/testkit';

describe('NavigationAgent3D strict validators', () => {
  it('passes a valid NavigationAgent3D with avoidance/path properties', () => {
    expectNoErrors(
      scene(
        node('NavigationAgent3D', {
          radius: 0.75,
          height: 1.8,
          avoidance_enabled: true,
          avoidance_layers: 2,
          avoidance_mask: 3,
          max_neighbors: 1,
          max_speed: '5.0',
          navigation_layers: 4,
          target_desired_distance: 1.5,
          path_desired_distance: 0.5,
          target_position: 'Vector3(1, 2, 3)',
        })
      )
    );
  });

  it('rejects a negative radius', () => {
    expectDiagnostic(scene(node('NavigationAgent3D', { radius: -1 })), {
      prop: 'radius',
      severity: 'error',
    });
  });

  it('warns on a negative max_neighbors', () => {
    // navigation_agent_3d.cpp:655-663 is a bare assignment (no ERR_FAIL), and the
    // hint's floor (1,10000,1,or_greater at :176) is advisory only, so this is a
    // warning rather than an error.
    expectDiagnostic(scene(node('NavigationAgent3D', { max_neighbors: -1 })), {
      prop: 'max_neighbors',
      severity: 'warning',
    });
  });
});
