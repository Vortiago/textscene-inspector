import type { ControlProperties } from '../control/types';

export interface FlowContainerProperties extends ControlProperties {
  /** `FlowContainer::AlignmentMode` (`flow_container.h:39-43`), default `ALIGNMENT_BEGIN` (0). */
  alignment?: number;
  /** `FlowContainer::LastWrapAlignmentMode` (`flow_container.h:44-49`), default `LAST_WRAP_ALIGNMENT_INHERIT` (0). */
  lastWrapAlignment?: number;
  /**
   * Main-axis orientation (`flow_container.h:56`, default `false`). Only a
   * plain `FlowContainer` node ever serialises this — `HFlowContainer`/
   * `VFlowContainer` fix it in their own constructors and hide the property
   * (`flow_container.h:99-113`); the solver resolves their orientation from
   * the node's own type name instead of this field.
   */
  vertical?: boolean;
  /** `flow_container.h:57`, default `false`. */
  reverseFill?: boolean;
}
