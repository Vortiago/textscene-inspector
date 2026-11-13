/** A canvas item's CanvasItem fields under their scene keys, whichever parse produced the node. */

import type { TscnNode } from '../parser/types';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { ControlCanvasItemFields } from '../nodes/2d/ui/control/types';

/** A Control's parse holds the fields camelCase (`ControlCanvasItemFields`), and always sets `zIndex`. */
export function canvasItemFieldsOf(node: TscnNode): Partial<Node2DProperties> {
  const props = node.properties as Partial<Node2DProperties> & Partial<ControlCanvasItemFields>;
  if (props.zIndex === undefined) return props;
  return {
    ...props,
    z_index: props.zIndex,
    z_as_relative: props.zAsRelative,
    texture_filter: props.textureFilter,
    texture_repeat: props.textureRepeat,
    use_parent_material: props.useParentMaterial,
  };
}
