/**
 * RemoteTransform2D strict validator coverage — the remote_path/update-flag
 * property surface, plus one probe that the spatial set arrives via the
 * Node2D base-chain walk (the slice registers no transform validator of its
 * own).
 */

import { describe, it } from 'vitest';
import './linterParser';
import '../../base/node2d/linterParser';
import { expectDiagnostic, expectNoErrors, node, scene } from '../../../linter/testing/testkit';

describe('RemoteTransform2D strict validators', () => {
  it('passes a valid RemoteTransform2D with remote_path and update flags', () => {
    expectNoErrors(
      scene(
        node('RemoteTransform2D', {
          remote_path: 'NodePath("../../Camera2D")',
          update_position: true,
          update_rotation: false,
          update_scale: true,
          use_global_coordinates: false,
        })
      )
    );
  });

  it('rejects a malformed transform (inherited from the Node2D validator set)', () => {
    expectDiagnostic(scene(node('RemoteTransform2D', { transform: 'Transform2D(nope)' })), {
      prop: 'transform',
      severity: 'error',
    });
  });

  it('rejects a malformed remote_path', () => {
    expectDiagnostic(scene(node('RemoteTransform2D', { remote_path: '"../../Camera2D"' })), {
      prop: 'remote_path',
      severity: 'error',
    });
  });
});
