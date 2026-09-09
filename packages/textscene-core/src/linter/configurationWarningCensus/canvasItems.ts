/**
 * `CanvasItem` and the 2D nodes whose warnings are about canvas state:
 * clip-children conflicts, scene-wide modulation, parallax placement, and the
 * deprecated `TileMap`.
 */
import type { WarningRow } from './types.js';

export const canvasItemWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  AnimatedSprite2D: [
    {
      at: 'animated_sprite_2d.cpp:594',
      says: 'requires a SpriteFrames resource to display frames',
      verdict: { rule: 'animatedsprite2d-requires-spriteframes' },
    },
  ],

  CanvasGroup: [
    {
      at: 'canvas_group.cpp:77',
      says: 'an ancestor clips its children, so this node cannot clip its own',
      verdict: { rule: 'canvasgroup-ancestor-clips-children' },
    },
    {
      at: 'canvas_group.cpp:83',
      says: 'nested inside another CanvasGroup',
      verdict: { rule: 'canvasgroup-nested-in-canvasgroup' },
    },
  ],

  CanvasItem: [
    {
      at: 'canvas_item.cpp:1309',
      says: 'an ancestor clips its children, so this node cannot clip its own',
      verdict: { rule: 'canvasitem-ancestor-clips-children' },
    },
    {
      at: 'canvas_item.cpp:1315',
      says: 'an ancestor is a CanvasGroup, so this node cannot clip its own children',
      verdict: { rule: 'canvasitem-ancestor-is-canvasgroup' },
    },
  ],

  CanvasModulate: [
    {
      at: 'canvas_modulate.cpp:123',
      says: 'more than one CanvasModulate in the scene, only one will be active',
      verdict: {
        declined: 'runtime-only',
        because: 'get_nodes_in_group("_canvas_modulate_" + canvas RID), a live-tree group query, canvas_modulate.cpp:120',
      },
      gate: 'visible-in-tree',
    },
  ],

  ParallaxLayer: [
    {
      at: 'parallax_layer.cpp:139',
      says: 'only works with a ParallaxBackground parent',
      verdict: { rule: 'parallaxlayer-outside-parallaxbackground' },
    },
  ],

  TileMap: [
    {
      at: 'tile_map.cpp:843',
      says: 'deprecated, superseded by TileMapLayer nodes',
      verdict: { rule: 'tilemap-deprecated' },
    },
    {
      at: 'tile_map.cpp:856',
      says: 'a Y-sorted layer shares a Z-index with a non-Y-sorted layer',
      verdict: { rule: 'tilemap-y-sort-z-index-conflict' },
    },
    {
      at: 'tile_map.cpp:865',
      says: 'a layer is Y-sorted, but Y-sort is not enabled on the TileMap itself',
      verdict: { rule: 'tilemap-layer-y-sort-without-node' },
    },
    {
      at: 'tile_map.cpp:879',
      says: 'the TileMap is Y-sorted, but no layer has Y-sort enabled',
      verdict: { rule: 'tilemap-node-y-sort-without-layer' },
    },
    {
      at: 'tile_map.cpp:896',
      says: 'isometric TileSet will likely not look right without Y-sort',
      verdict: {
        declined: 'runtime-only',
        because: "referenced tile_set's tile_shape VALUE, tile_map.cpp:884",
      },
    },
  ],
};
