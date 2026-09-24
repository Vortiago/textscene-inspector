/**
 * SoftBody3D linter: the semantic rule, through `Linter`.
 *
 * Ports SoftBody3D::get_configuration_warnings (soft_body_3d.cpp:401-407):
 * `if (mesh.is_null()) warnings.push_back(RTR("This body will be ignored
 * until you set a mesh."));`.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('SoftBody3D Linter', () => {
  it('warns when no mesh is set, matching soft_body_3d.cpp:404-406', () => {
    expectDiagnostic(scene(node('SoftBody3D', {})), {
      ruleName: 'valid-softbody3d-mesh',
      severity: 'warning',
      nodeType: 'SoftBody3D',
      contains: ['mesh'],
    });
  });

  it('is clean once a mesh is set', () => {
    expectClean(
      scene(
        '[sub_resource type="BoxMesh" id="mesh_1"]',
        node('SoftBody3D', { mesh: 'SubResource("mesh_1")' })
      )
    );
  });

  it('does not fire for a plain MeshInstance3D (that node type has no such warning)', () => {
    expectNoDiagnostic(scene(node('MeshInstance3D', {})), {
      ruleName: 'valid-softbody3d-mesh',
    });
  });
});
