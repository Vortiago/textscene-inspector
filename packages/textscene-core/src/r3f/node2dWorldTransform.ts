/**
 * 2D world-transform composition over the LIVE scene tree — resolves a node's
 * root→target chain of effective nodes (descending into instanced sub-scenes,
 * so a Camera2D inside an instance composes correctly instead of framing at the
 * origin) and multiplies each Node2D local transform (Godot +Y-down pixel space,
 * T·R·Skew·S per node, the same semantics the parser decodes and node2dTransform
 * conjugates for rendering). Non-2D ancestors (plain Node containers, Node3D…)
 * contribute identity. Pure module — used by the Cameras panel to frame the 2D
 * stage on a Camera2D's world position without touching live THREE objects.
 */

import type { TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';

interface Affine2D {
  // Column-major 2×2 linear part + origin (Godot Transform2D layout).
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ox: number;
  oy: number;
}

const IDENTITY: Affine2D = { ax: 1, ay: 0, bx: 0, by: 1, ox: 0, oy: 0 };

function localAffine(node: TscnNode): Affine2D {
  const props = node.properties as Record<string, unknown> | undefined;
  const position = props?.position as { x: number; y: number } | undefined;
  if (!position || typeof position.x !== 'number') return IDENTITY;

  const rotation = typeof props?.rotation === 'number' ? (props.rotation as number) : 0;
  const scale = (props?.scale as { x: number; y: number } | undefined) ?? { x: 1, y: 1 };
  const skew = typeof props?.skew === 'number' ? (props.skew as number) : 0;

  // Godot Transform2D from T·R·Skew·S: x-axis (cos r, sin r)·sx,
  // y-axis (−sin(r+skew), cos(r+skew))·sy.
  return {
    ax: Math.cos(rotation) * scale.x,
    ay: Math.sin(rotation) * scale.x,
    bx: 0 - Math.sin(rotation + skew) * scale.y,
    by: Math.cos(rotation + skew) * scale.y,
    ox: position.x,
    oy: position.y,
  };
}

function multiply(parent: Affine2D, child: Affine2D): Affine2D {
  return {
    ax: parent.ax * child.ax + parent.bx * child.ay,
    ay: parent.ay * child.ax + parent.by * child.ay,
    bx: parent.ax * child.bx + parent.bx * child.by,
    by: parent.ay * child.bx + parent.by * child.by,
    ox: parent.ax * child.ox + parent.bx * child.oy + parent.ox,
    oy: parent.ay * child.ox + parent.by * child.oy + parent.oy,
  };
}

/**
 * The node's world position in Godot pixel space, or null for unknown paths.
 * Walks the live tree (so a Camera2D inside an instanced sub-scene resolves and
 * composes against the instance node's merged transform), composing each
 * effective ancestor's Node2D local transform.
 */
export function node2dWorldPosition(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  path: string
): { x: number; y: number } | null {
  const chain = liveNodeChain(path, roots, ctx);
  if (!chain) return null;

  let world = IDENTITY;
  for (const node of chain) world = multiply(world, localAffine(node));
  return { x: world.ox, y: world.oy };
}
