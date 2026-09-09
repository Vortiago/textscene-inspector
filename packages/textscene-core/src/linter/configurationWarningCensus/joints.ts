/**
 * `Joint2D` and `Joint3D`.
 *
 * Each surfaces five mutually-exclusive strings through a SINGLE `push_back`,
 * which is why each has five rows: a row is one condition, not one push.
 */
import type { WarningRow } from './types.js';

export const jointWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  Joint2D: [
    {
      at: 'joint_2d.cpp:81',
      says: 'Node A must be a PhysicsBody2D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_a resolves to, joint_2d.cpp:81',
      },
    },
    {
      at: 'joint_2d.cpp:83',
      says: 'Node B must be a PhysicsBody2D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_b resolves to, joint_2d.cpp:83',
      },
    },
    {
      at: 'joint_2d.cpp:79',
      says: 'Node A and Node B must both be PhysicsBody2Ds',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the classes node_a and node_b resolve to, joint_2d.cpp:79',
      },
    },
    {
      at: 'joint_2d.cpp:85',
      says: 'not connected to two PhysicsBody2Ds',
      verdict: { rule: 'joint-not-connected' },
    },
    {
      at: 'joint_2d.cpp:87',
      says: 'Node A and Node B must be different PhysicsBody2Ds',
      verdict: { rule: 'joint-same-body' },
    },
  ],

  Joint3D: [
    {
      at: 'joint_3d.cpp:77',
      says: 'Node A and Node B must both be PhysicsBody3Ds',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the classes node_a and node_b resolve to, joint_3d.cpp:77',
      },
    },
    {
      at: 'joint_3d.cpp:79',
      says: 'Node A must be a PhysicsBody3D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_a resolves to, joint_3d.cpp:79',
      },
    },
    {
      at: 'joint_3d.cpp:81',
      says: 'Node B must be a PhysicsBody3D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_b resolves to, joint_3d.cpp:81',
      },
    },
    {
      at: 'joint_3d.cpp:83',
      says: 'not connected to any PhysicsBody3Ds',
      verdict: { rule: 'joint-not-connected' },
    },
    {
      at: 'joint_3d.cpp:85',
      says: 'Node A and Node B must be different PhysicsBody3Ds',
      verdict: { rule: 'joint-same-body' },
    },
  ],
};
