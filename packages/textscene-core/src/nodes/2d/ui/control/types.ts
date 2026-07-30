/** Base Control (Godot 2D UI) property definitions. */

export interface ControlColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Layout/positioning + theme-override properties shared by every Control.
 * Type-specific Controls (Label, Button, …) extend this.
 */
export interface ControlProperties {
  name: string;
  parent?: string;
  instance?: string;
  index?: number;
  visible?: boolean;

  /** 0 = position (free), 1 = anchors, 2 = container-managed. */
  layoutMode?: number;
  /** LayoutPreset 0..15, or undefined/-1 for custom anchors. */
  anchorsPreset?: number;
  anchorLeft?: number;
  anchorTop?: number;
  anchorRight?: number;
  anchorBottom?: number;
  offsetLeft?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  growHorizontal?: number;
  growVertical?: number;

  /** Container child sizing bitmask (1=FILL, 2=EXPAND, 4=SHRINK_CENTER, 8=SHRINK_END). */
  sizeFlagsHorizontal?: number;
  sizeFlagsVertical?: number;
  /** Proportion of EXPAND space this child claims among its siblings (default 1.0). */
  sizeFlagsStretchRatio?: number;
  customMinimumSize?: { x: number; y: number };

  /**
   * CanvasItem tint applied to this node AND its CanvasItem children.
   * Godot default `Color(1, 1, 1, 1)`; absent means "no tint".
   */
  modulate?: ControlColor;
  /** CanvasItem tint applied to this node ONLY, not its children. */
  selfModulate?: ControlColor;

  /** Rotation about the pivot, in RADIANS (the inspector shows degrees). */
  rotation?: number;
  /** Scale about the pivot; a negative axis mirrors. */
  scale?: { x: number; y: number };
  /** Pivot offset in pixels from the node's top-left. */
  pivotOffset?: { x: number; y: number };
  /**
   * Pivot offset as a fraction of the node's own size — `(1, 1)` is the
   * bottom-right corner. The effective pivot is this PLUS `pivotOffset`.
   */
  pivotOffsetRatio?: { x: number; y: number };

  /**
   * CanvasItem draw-order index (`z_index`). Godot default `0`
   * (`scene/main/canvas_item.h:101`). The hint range is `[-4096, 4096]`
   * (`CANVAS_ITEM_Z_MIN`/`CANVAS_ITEM_Z_MAX`,
   * `servers/rendering/rendering_server.h:103-104`) but that is only a
   * `PROPERTY_HINT_RANGE` for the inspector slider, not a setter guard —
   * `CanvasItem::set_z_index` never clamps or rejects an out-of-range value.
   */
  zIndex?: number;
  /**
   * CanvasItem `show_behind_parent` — when true this Control draws behind
   * its parent instead of in front. Godot default `false`
   * (`scene/main/canvas_item.h:113`, the backing `behind` field).
   */
  showBehindParent?: boolean;
  /**
   * CanvasItem `light_mask`: which 2D lights may reach this Control (ANDed
   * against a light's `range_item_cull_mask`). Godot default `1`
   * (`scene/main/canvas_item.h:98`). Per-item, NOT inherited by children.
   */
  lightMask?: number;
  /**
   * CanvasItem `texture_filter` (`CanvasItem::TextureFilter`,
   * `scene/main/canvas_item.h:52-60`). Godot default `0` =
   * `TEXTURE_FILTER_PARENT_NODE` — inherit the ancestor's (eventually the
   * viewport's) filter rather than naming one of its own
   * (`scene/main/canvas_item.h:123`).
   */
  textureFilter?: number;
  /**
   * CanvasItem `texture_repeat` (`CanvasItem::TextureRepeat`,
   * `scene/main/canvas_item.h:63-69`). Godot default `0` =
   * `TEXTURE_REPEAT_PARENT_NODE` — inherit rather than name a repeat mode of
   * its own (`scene/main/canvas_item.h:124`).
   */
  textureRepeat?: number;

  /** `theme_override_constants/<name>` → number (e.g. separation, margin_left). */
  themeOverrideConstants?: Record<string, number>;
  /** `theme_override_colors/<name>` → color (e.g. font_color). */
  themeOverrideColors?: Record<string, ControlColor>;
  /** `theme_override_font_sizes/<name>` → number. */
  themeOverrideFontSizes?: Record<string, number>;
  /** `theme_override_styles/<name>` → resource ref (e.g. panel → StyleBox). */
  themeOverrideStyles?: Record<string, string>;
}
