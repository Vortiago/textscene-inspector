/**
 * NavigationObstacle3D strict validator coverage — the avoidance property
 * surface, plus one probe that the spatial set arrives via the Node3D
 * base-chain walk (the slice registers no transform validator of its own).
 */

import { describe, it } from 'vitest';
import './linterParser';
import '../../base/node3d/linterParser';
import { expectDiagnostic, expectNoErrors, node, scene } from '../../../linter/testing/testkit';

describe('NavigationObstacle3D strict validators', () => {
  it('passes a valid NavigationObstacle3D with radius/height/avoidance properties', () => {
    expectNoErrors(
      scene(
        node('NavigationObstacle3D', {
          radius: 1.5,
          height: '2.0',
          avoidance_enabled: true,
          avoidance_layers: 2,
          affect_navigation_mesh: true,
          carve_navigation_mesh: true,
          use_3d_avoidance: true,
        })
      )
    );
  });

  it('rejects a malformed transform (inherited from the Node3D validator set)', () => {
    expectDiagnostic(scene(node('NavigationObstacle3D', { transform: 'Transform3D(nope)' })), {
      prop: 'transform',
      severity: 'error',
    });
  });

  it('rejects a negative radius', () => {
    expectDiagnostic(scene(node('NavigationObstacle3D', { radius: -1 })), {
      prop: 'radius',
      severity: 'error',
    });
  });

  it('rejects a negative height', () => {
    expectDiagnostic(scene(node('NavigationObstacle3D', { height: -1 })), {
      prop: 'height',
      severity: 'error',
    });
  });
});
