import type { ControlProperties } from '../control/types';

export interface ReferenceRectProperties extends ControlProperties {
  /** Raw Godot `Color(r,g,b,a)` string (`reference_rect.cpp:98`); default `Color(1, 0, 0)`. */
  borderColor?: string;
  /** `reference_rect.cpp:99` — the setter's own `MAX(0, width)` floor (`:62`) already applied; default `1.0`. */
  borderWidth?: number;
  /** `reference_rect.cpp:100` — default `true`. */
  editorOnly?: boolean;
}
