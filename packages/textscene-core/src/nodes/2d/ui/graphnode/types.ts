import type { ControlColor } from '../control/types';
import type { GraphElementProperties } from '../graphelement/types';

/** `GraphNode::Slot` (`graph_node.h:41-52`), the class-default every leaf starts from. */
export interface GraphNodeSlot {
  leftEnabled: boolean;
  leftType: number;
  leftColor: ControlColor;
  /** Resource-ref token (`ExtResource(...)`/`SubResource(...)`), or absent for the default null icon. */
  leftIcon?: string;
  rightEnabled: boolean;
  rightType: number;
  rightColor: ControlColor;
  rightIcon?: string;
  drawStylebox: boolean;
}

export interface GraphNodeProperties extends GraphElementProperties {
  /** `title` — `graph_node.cpp:1299`. Default `""` (`graph_node.h`, `String title;`). */
  title?: string;
  /** `ignore_invalid_connection_type` — `graph_node.cpp:1300`. Default `false` (`graph_node.h:118`). */
  ignoreInvalidConnectionType?: boolean;
  /**
   * `slots_focus_mode` — `graph_node.cpp:1301`, `PROPERTY_HINT_ENUM
   * "Click:1,All:2,Accessibility:3"`. Default `Control::FOCUS_ACCESSIBILITY`
   * = 3 (`graph_node.h:90`).
   */
  slotsFocusMode?: number;
  /**
   * `slot/<index>/<leaf>` — never an `ADD_PROPERTY`, read from
   * `GraphNode::_get_property_list`/`_set`/`_get` (`graph_node.cpp:38-151`).
   * Keyed by the index as `_set` resolves it (bare `to_int()`,
   * `graph_node.cpp:45`, no validity gate — `toIntIndex`'s own semantics).
   * Only a surviving (non-erased, see `parser.ts`) slot appears here.
   */
  slots: Map<number, GraphNodeSlot>;
}
