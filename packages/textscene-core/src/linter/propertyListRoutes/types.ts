/**
 * The shape of one property-list route row. It has its own file so the family
 * parts can import it without importing the table they are concatenated into.
 */

export interface RouteRow {
  /** The Godot class whose override introduces this family. */
  readonly type: string;
  /**
   * The override that builds the family, `file.cpp:line`, basename only: a
   * `PropertyListHelper`/`register_property`, an `ADD_ARRAY_COUNT`, or a
   * `_set`/`_get`/property-list override, which `ChainIK3D::get_property_list`
   * shows need not be underscore-prefixed.
   */
  readonly at: string;
  /**
   * A concrete key of this family, exactly as it lands in a `.tscn`, passed to
   * `validatorRegistry.findValidator`. A `validated` row resolves on every
   * registered descendant of `type`, and an `unimplemented` row stays `null`.
   */
  readonly sample: string;
  readonly verdict:
    | { readonly validated: true }
    | {
        readonly declined: 'no-storage-bit' | 'never-owned' | 'runtime-shaped';
        readonly because: string;
      }
    | { readonly unimplemented: string };
}
