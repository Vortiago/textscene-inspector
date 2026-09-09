/**
 * The shape of one property-list route row.
 *
 * Split out from `propertyListRoutes.ts` so the family parts beside this file
 * can import it without importing the table they are concatenated into.
 */

export interface RouteRow {
  /** The Godot class whose override introduces this family. */
  readonly type: string;
  /** The override that builds the family, `file.cpp:line`, basename only. */
  readonly at: string;
  /** A concrete key of this family, exactly as it lands in a `.tscn`. */
  readonly sample: string;
  readonly verdict:
    | { readonly validated: true }
    | {
        readonly declined: 'no-storage-bit' | 'never-owned' | 'runtime-shaped';
        readonly because: string;
      }
    | { readonly unimplemented: string };
}
