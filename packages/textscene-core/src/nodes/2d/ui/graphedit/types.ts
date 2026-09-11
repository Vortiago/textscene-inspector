import type { ControlProperties } from '../control/types';

/**
 * GraphEdit's own members THE RENDERER READS. `GraphEdit` serialises many
 * more properties than these five (`type_names`, `connections`, the zoom/
 * minimap/toolbar family — `linterParser.ts` validates all of them), but
 * nothing else here has a static picture: the toolbar/minimap are internal
 * children with no scene-authored geometry, and `connections` (which DOES
 * serialise — `graph_edit.cpp:3083`'s `ADD_PROPERTY`/`set_connections` — see
 * `Component.tsx`'s own doc for why this renderer still cannot draw one).
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
}
