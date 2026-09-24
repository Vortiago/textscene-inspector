/**
 * Nodes that drive another node's transform or animation state: `AnimationTree`, the `PathFollow` pair and the
 * `RemoteTransform` pair. Each `PathFollow` reaches one `push_back` from two placements (`cast_to<Path2D>(get_parent())`
 * is null at the scene root too), and the parentless case has its own rule name, so each placement is its own row.
 */
import type { WarningRow } from './types.js';

export const transformDriverWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  AnimationTree: [
    {
      at: 'animation_tree.cpp:720',
      says: 'no root AnimationNode for the graph is set',
      verdict: { rule: 'animationtree-missing-tree-root' },
    },
  ],

  // `cast_to<Path2D>(get_parent())` is null at the scene root too, so one
  // push_back covers both placements; this repo phrases the parentless case as
  // its own rule name, which is the split the row model already allows.
  PathFollow2D: [
    {
      at: 'path_2d.cpp:386',
      says: 'only works as a child of a Path2D node',
      verdict: { rule: 'pathfollow2d-invalid-parent' },
      gate: 'visible-in-tree',
    },
    {
      at: 'path_2d.cpp:386',
      says: 'only works as a child of a Path2D node',
      verdict: { rule: 'pathfollow2d-no-parent' },
      gate: 'visible-in-tree',
    },
  ],

  PathFollow3D: [
    {
      at: 'path_3d.cpp:359',
      says: 'only works as a child of a Path3D node',
      verdict: { rule: 'pathfollow3d-invalid-parent' },
      gate: 'visible-in-tree',
    },
    {
      at: 'path_3d.cpp:359',
      says: 'only works as a child of a Path3D node',
      verdict: { rule: 'pathfollow3d-no-parent' },
      gate: 'visible-in-tree',
    },
    {
      at: 'path_3d.cpp:363',
      says: 'ROTATION_ORIENTED requires Up Vector enabled on the parent Path3D curve',
      verdict: { rule: 'pathfollow3d-oriented-mode-requires-up-vector' },
      gate: 'visible-in-tree',
    },
  ],

  RemoteTransform2D: [
    {
      at: 'remote_transform_2d.cpp:217',
      says: 'Path property must point to a valid Node2D node',
      verdict: { rule: 'remotetransform2d-invalid-remote-path' },
    },
  ],

  RemoteTransform3D: [
    {
      at: 'remote_transform_3d.cpp:209',
      says: 'Remote Path property must point to a valid Node3D node',
      verdict: { rule: 'remotetransform3d-invalid-remote-path' },
    },
  ],
};
