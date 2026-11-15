/**
 * The properties of a tile canvas item that sits below a group which already carries the parent's
 * transform, modulate, z and visibility: a row of a y-sorted layer below its layer, or a layer
 * below its TileMap.
 */

import type { Node2DProperties } from '../../../base/node2d/types';
import type { Rgba } from '../../../../godot/math/math';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `props` with the Node2D transform reset to the identity. */
export function withoutNode2DTransform<T extends Node2DProperties>(props: T): T {
  return { ...props, position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, skew: 0 };
}

/**
 * `parent`'s properties with the canvas state the group above holds reset. Self modulate, light
 * mask and sampler stay: a row takes the layer's self modulate (`tile_map_layer.cpp:358`), and the
 * parent's material through `use_parent_material` (`tile_map_layer.cpp:350`).
 */
export function childCanvasItemProperties<T extends Node2DProperties>(parent: T): T {
  const { materialPath: _materialPath, ...inherited } = parent;
  return {
    ...withoutNode2DTransform(inherited as T),
    modulate: WHITE,
    z_index: 0,
    z_as_relative: true,
    show_behind_parent: false,
    top_level: false,
    clip_children: 0,
    visible: true,
    use_parent_material: true,
  } as T;
}
