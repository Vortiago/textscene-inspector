/** Base Control (Godot 2D UI) property definitions. */

export interface ControlColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The layout and theme-override properties of every Control. Each Control type extends it. */
export interface ControlProperties {
  name: string;
  parent?: string;
  instance?: string;
  index?: number;
  visible?: boolean;

  /** 0 = position (free), 1 = anchors, 2 = container-managed, 3 = uncontrolled. */
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

  /**
   * `Control::LayoutDirection` (`scene/gui/control.h:155-160`): 0 INHERITED,
   * 1 APPLICATION_LOCALE, 2 LTR, 3 RTL, 4 SYSTEM_LOCALE. The solve-tree walk
   * resolves it to one boolean per node (`SolveNode.rtl`).
   */
  layoutDirection?: number;

  /** Container child sizing bitmask (1=FILL, 2=EXPAND, 4=SHRINK_CENTER, 8=SHRINK_END). */
  sizeFlagsHorizontal?: number;
  sizeFlagsVertical?: number;
  /** The share of EXPAND space this child takes among its siblings (default 1.0). */
  sizeFlagsStretchRatio?: number;
  customMinimumSize?: { x: number; y: number };

  /**
   * CanvasItem tint of this node and its CanvasItem children. Default
   * `Color(1, 1, 1, 1)`: absent means no tint.
   */
  modulate?: ControlColor;
  /** CanvasItem tint of this node only, not its children. */
  selfModulate?: ControlColor;

  /** Rotation about the pivot, in radians. The inspector shows degrees. */
  rotation?: number;
  /** Scale about the pivot. A negative axis mirrors. */
  scale?: { x: number; y: number };
  /** Pivot offset in pixels from the node's top-left. */
  pivotOffset?: { x: number; y: number };
  /**
   * Pivot offset as a fraction of the node's size: `(1, 1)` is the bottom-right
   * corner. The pivot is this plus `pivotOffset`.
   */
  pivotOffsetRatio?: { x: number; y: number };

  /**
   * CanvasItem draw-order index (`z_index`), default `0` (`scene/main/canvas_item.h:101`),
   * in `[-4096, 4096]` (`CANVAS_ITEM_Z_MIN`/`CANVAS_ITEM_Z_MAX`,
   * `servers/rendering/rendering_server.h:103-104`).
   */
  zIndex?: number;
  /**
   * CanvasItem `show_behind_parent`: the Control draws behind its parent. Default
   * `false` (`scene/main/canvas_item.h:113`, the `behind` field).
   */
  showBehindParent?: boolean;
  /**
   * CanvasItem `top_level`: the Control is a canvas root. The `NOTIFICATION_ENTER_CANVAS`
   * climb does not start (`control.cpp:3876`), and no Container lays it out (`container.cpp:143-146`).
   */
  topLevel?: boolean;
  /**
   * CanvasItem `light_mask`: the 2D lights that reach this Control, ANDed with a light's
   * `range_item_cull_mask`. Default `1` (`scene/main/canvas_item.h:98`). Children do not inherit it.
   */
  lightMask?: number;
  /**
   * CanvasItem `texture_filter` (`scene/main/canvas_item.h:52-60`). Default `0` is
   * `TEXTURE_FILTER_PARENT_NODE` (`scene/main/canvas_item.h:123`): the ancestor's filter,
   * and at the top the viewport's.
   */
  textureFilter?: number;
  /**
   * CanvasItem `texture_repeat` (`scene/main/canvas_item.h:63-69`). Default `0` is
   * `TEXTURE_REPEAT_PARENT_NODE` (`scene/main/canvas_item.h:124`): the ancestor's mode.
   */
  textureRepeat?: number;

  /** `theme_override_constants/<name>` to a number, for example separation. */
  themeOverrideConstants?: Record<string, number>;
  /** `theme_override_colors/<name>` to a colour, for example font_color. */
  themeOverrideColors?: Record<string, ControlColor>;
  /** `theme_override_font_sizes/<name>` to a number. */
  themeOverrideFontSizes?: Record<string, number>;
  /** `theme_override_styles/<name>` to a resource reference, for example a StyleBox. */
  themeOverrideStyles?: Record<string, string>;
  /** `theme_override_icons/<name>` to a resource reference, for example a Texture2D. */
  themeOverrideIcons?: Record<string, string>;
  /** `theme_override_fonts/<name>` to a resource reference: a FontFile, FontVariation or SystemFont. */
  themeOverrideFonts?: Record<string, string>;

  /**
   * The raw reference of this Control's own Theme, resolved later as
   * `themeOverrideStyles` is. Undefined when unset: the Control inherits an ancestor's theme.
   */
  theme?: string;
  /**
   * `theme_type_variation`: the name theme items are looked up under in place of
   * the class name (`scene/gui/control.h`). Godot writes `&"HeaderLabel"`, and the
   * parser strips the `&` and the quotes.
   */
  themeTypeVariation?: string;
}
