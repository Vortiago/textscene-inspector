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
 * GraphEdit's own members THE RENDERER READS. `GraphEdit` serialises many
 * more properties than these (`type_names`, the zoom/minimap/toolbar family —
 * `linterParser.ts` validates all of them), but nothing else here has a
 * static picture: the toolbar/minimap are internal children with no
 * scene-authored geometry.
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
}
