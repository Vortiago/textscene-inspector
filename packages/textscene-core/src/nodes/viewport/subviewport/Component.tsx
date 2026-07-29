/**
 * SubViewport — a canvas boundary that is not a world boundary (ADR-0030).
 *
 * Godot's `Viewport` always instantiates its own `World2D` but resolves
 * `World3D` by walking UP to the parent viewport unless `own_world_3d` is set
 * (`Viewport::find_world_2d` / `find_world_3d`). So a sub-viewport's Node3D
 * descendants really do draw in the parent's 3D view, while its CanvasItem
 * descendants never draw in the parent's canvas — measured through Godot 4.6.3,
 * not derived.
 *
 * Both halves fall out of the REGISTRATION rather than of any code here: the
 * slice registers with neither `canvasItem` nor `container`, so `PlainNode`'s
 * existing workspace branches pass it through in the 3D workspace and drop its
 * whole subtree in the 2D one. The only behaviour this component owns is the
 * `own_world_3d` gate — severing the shared World3D, which is what stops the 3D
 * descendants drawing too.
 *
 * `disable_3d` is deliberately NOT consulted: it disables the viewport's own 3D
 * pass, and a probe render confirms it leaves the parent view untouched.
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';
import type { SubViewportProperties } from './types';

export function SubViewport({ node, children }: NodeComponentProps) {
  const { own_world_3d: ownWorld3D } = node.properties as SubViewportProperties;
  // An own-world sub-viewport still renders — into its OWN target, which the
  // offscreen publisher owns — but contributes nothing to the parent's world.
  return <Node node={node}>{ownWorld3D ? null : children}</Node>;
}
