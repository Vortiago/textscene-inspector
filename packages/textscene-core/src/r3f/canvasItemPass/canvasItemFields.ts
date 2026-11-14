/**
 * The one reader of a node's CanvasItem fields. A Node2D's parse holds them in snake case and a
 * Control's in camel case (`ControlCanvasItemFields`), so every reader that asks both goes here.
 */

import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';
import type { Rgba } from '../../godot/math/math';
import type { Transform2DColumns } from '../../godot/math/transform2d';
import {
  CanvasItemClipChildrenMode,
  CanvasItemTextureFilter,
  CanvasItemTextureRepeat,
} from '../../godot/scene/canvasItem';
import { isCanvasItem, isControlType } from '../canvasItemClass';
import { WHITE_MODULATE } from '../canvasItemModulate';
import { node2DLocalTransform } from '../node2dTransform';
import { perObject } from '../../utils/perObject';

/** What one canvas item states of itself, before anything it inherits. */
export interface CanvasItemNodeFields {
  /** The item's own transform, or null for a Control: its transform is the solved rect. */
  readonly local: Transform2DColumns | null;
  readonly modulate: Rgba;
  readonly zIndex: number;
  readonly zAsRelative: boolean;
  /** The `material` reference as the file writes it, which resolves in the item's scope. */
  readonly materialRef: string | undefined;
  readonly usesParentMaterial: boolean;
  /** `texture_filter`, where 0 is PARENT_NODE (`canvas_item.h:52-60`). */
  readonly textureFilter: number;
  /** `texture_repeat`, where 0 is PARENT_NODE (`canvas_item.h:63-69`). */
  readonly textureRepeat: number;
  readonly isTopLevel: boolean;
  /** `clip_children`, a `CanvasItemClipChildrenMode` value. */
  readonly clipChildren: number;
  readonly ySortEnabled: boolean;
  readonly showsBehindParent: boolean;
}

/**
 * Null for a node that is no CanvasItem. Once for each node object, since the paint order asks a
 * node's flags on each allocation.
 *
 * @canonical The CanvasItem fields a node states of itself, whichever parse produced it
 */
export const canvasItemFieldsOf = perObject((node: TscnNode): CanvasItemNodeFields | null => {
  if (isControlType(node.type)) return controlFieldsOf(node);
  if (!isCanvasItem(node)) return null;
  return node2DFieldsOf(node);
});

/** The defaults stand in for a hand-built node: the parse sets every field but `modulate`. */
function controlFieldsOf(node: TscnNode): CanvasItemNodeFields {
  const props = node.properties as Partial<ControlProperties>;
  return {
    local: null,
    modulate: props.modulate ?? WHITE_MODULATE,
    zIndex: props.zIndex ?? 0,
    zAsRelative: props.zAsRelative !== false,
    materialRef: props.materialPath,
    usesParentMaterial: props.useParentMaterial === true,
    textureFilter: props.textureFilter ?? CanvasItemTextureFilter.PARENT_NODE,
    textureRepeat: props.textureRepeat ?? CanvasItemTextureRepeat.PARENT_NODE,
    isTopLevel: props.topLevel === true,
    clipChildren: props.clipChildren ?? CanvasItemClipChildrenMode.DISABLED,
    ySortEnabled: props.ySortEnabled === true,
    showsBehindParent: props.showBehindParent === true,
  };
}

function node2DFieldsOf(node: TscnNode): CanvasItemNodeFields {
  const props = node.properties as Partial<Node2DProperties>;
  return {
    local: node2DLocalTransform(props),
    modulate: props.modulate ?? WHITE_MODULATE,
    zIndex: props.z_index ?? 0,
    zAsRelative: props.z_as_relative !== false,
    materialRef: props.materialPath,
    usesParentMaterial: props.use_parent_material === true,
    textureFilter: props.texture_filter ?? CanvasItemTextureFilter.PARENT_NODE,
    textureRepeat: props.texture_repeat ?? CanvasItemTextureRepeat.PARENT_NODE,
    isTopLevel: props.top_level === true,
    clipChildren: props.clip_children ?? CanvasItemClipChildrenMode.DISABLED,
    ySortEnabled: props.y_sort_enabled === true,
    showsBehindParent: props.show_behind_parent === true,
  };
}
