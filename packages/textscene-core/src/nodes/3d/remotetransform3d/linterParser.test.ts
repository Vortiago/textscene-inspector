/**
 * RemoteTransform3D strict validator coverage — the remote_path/update-flag
 * property surface, plus one probe that the spatial set arrives via the
 * Node3D base-chain walk (the slice registers no transform validator of its
 * own).
 */

import { describe, it } from 'vitest';
import './linterParser';
import '../../base/node3d/linterParser';
import { expectDiagnostic, expectNoErrors, node, scene } from '../../../linter/testing/testkit';

describe('RemoteTransform3D strict validators', () => {
  it('passes a valid RemoteTransform3D with remote_path and update flags', () => {
    expectNoErrors(
      scene(
        node('RemoteTransform3D', {
          remote_path: 'NodePath("../DetachTransform/Geometry")',
          update_position: true,
          update_rotation: false,
          update_scale: false,
          use_global_coordinates: true,
        })
      )
    );
  });

  it('rejects a malformed transform (inherited from the Node3D validator set)', () => {
    expectDiagnostic(scene(node('RemoteTransform3D', { transform: 'Transform3D(nope)' })), {
      prop: 'transform',
      severity: 'error',
    });
  });

  it('rejects a malformed remote_path', () => {
    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    expectDiagnostic(scene(node('RemoteTransform3D', { remote_path: '&"../DetachTransform/Geometry"' })), {
      prop: 'remote_path',
      severity: 'error',
    });
  });
});
