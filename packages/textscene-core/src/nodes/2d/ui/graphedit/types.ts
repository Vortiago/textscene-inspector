import type { ControlProperties } from '../control/types';

/**
 * One `connections` entry — `graph_edit.cpp:2533-2543`'s `set_connections`
 * reads `from_node`/`from_port`/`to_node`/`to_port` off each Dictionary;
 * `keep_alive` is not carried here because it never changes what a STATIC
 * load draws (`Component.tsx`'s own doc).
 */
export interface GraphEditConnection {
  fromNode: string;
  fromPort: number;
  toNode: string;
  toPort: number;
}

/**
 * GraphEdit's own members THE RENDERER READS. `GraphEdit` serialises a few
 * more (`type_names`, `panning_scheme`, `right_disconnects`, the zoom
 * bounds/step — `linterParser.ts` validates all of them), which reach no
 * frozen frame.
 */
export interface GraphEditProperties extends ControlProperties {
  /** `scroll_offset` — `graph_edit.cpp:3069`. Default `Vector2()` (`graph_edit.h:234`). */
  scrollOffset?: { x: number; y: number };
  /** `zoom` — `graph_edit.cpp:3086`. Default `1.0` (`graph_edit.h:226`). */
  zoom?: number;
  /** `show_grid` — `graph_edit.cpp:3070`. Default `true` (`graph_edit.h:200`). */
  showGrid?: boolean;
  /** `grid_pattern` — `graph_edit.cpp:3071`, `PROPERTY_HINT_ENUM "Lines,Dots"`. Default `0` (LINES, `graph_edit.h:201`). */
  gridPattern?: number;
  /** `snapping_distance` — `graph_edit.cpp:3073`. Default `20` (`graph_edit.h:199`). */
  snappingDistance?: number;
  /** `connection_lines_curvature` — `graph_edit.cpp:3080`. Default `0.5` (`graph_edit.h:253`). */
  connectionLinesCurvature?: number;
  /** `connection_lines_thickness` — `graph_edit.cpp:3081`. Default `4.0` (`graph_edit.h:252`). */
  connectionLinesThickness?: number;
  /** `connections` — `graph_edit.cpp:3083`. Absent/malformed entries drop out; default `[]`. */
  connections: GraphEditConnection[];
  /** `snapping_enabled` — `graph_edit.cpp:3072`; `set_snapping_enabled` mirrors it into `toggle_snapping_button`'s pressed state (`:2709`). Default `true` (`graph_edit.h:198`). */
  snappingEnabled?: boolean;
  /** `minimap_enabled` — `graph_edit.cpp:3092`. Default `true`: the constructor seeds `minimap_button->set_pressed(show_grid)` off the MEMBER default (`:3311`), which no scene property reaches. */
  minimapEnabled?: boolean;
  /** `minimap_size` — `graph_edit.cpp:3093`. Default `Vector2(240, 160)` (`:3326`), floored per axis by the minimap's own `custom_minimum_size` of 50 (`:3332`). */
  minimapSize?: { x: number; y: number };
  /** `minimap_opacity` — `graph_edit.cpp:3094`, the minimap's `modulate.a`. Default `0.65` (`:3327`). */
  minimapOpacity?: number;
  /** `show_menu` — `graph_edit.cpp:3097`. Default `true` (`graph_edit.h:191`). */
  showMenu?: boolean;
  /** `show_zoom_label` — `graph_edit.cpp:3098`. Default `false` (`graph_edit.h:192`). */
  showZoomLabel?: boolean;
  /** `show_zoom_buttons` — `graph_edit.cpp:3099`. Default `true` (`graph_edit.h:194`). */
  showZoomButtons?: boolean;
  /** `show_grid_buttons` — `graph_edit.cpp:3100`. Default `true` (`graph_edit.h:193`). */
  showGridButtons?: boolean;
  /** `show_minimap_button` — `graph_edit.cpp:3101`. Default `true` (`graph_edit.h:195`). */
  showMinimapButton?: boolean;
  /** `show_arrange_button` — `graph_edit.cpp:3102`. Default `true` (`graph_edit.h:196`). */
  showArrangeButton?: boolean;
}
