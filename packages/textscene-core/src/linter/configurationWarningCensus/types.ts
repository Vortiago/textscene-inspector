/**
 * The row shape of the configuration-warning census, apart from `configurationWarningCensus.ts` so the family parts
 * import the types without the table that assembles them.
 */

/** Why a row is declined, typed so a reader audits a decline at a glance rather than trusting free text. */
export type DeclineCategory =
  /** Needs a live tree, resolved resource contents, engine or OS state, or a project setting: none is in the file. */
  | 'runtime-only'
  /** The deciding fact lives in a sub-scene behind `instance=`, which the linter never opens. */
  | 'instance-opaque'
  /** The triggering value is the serialised default, so Godot writes no key, and its absence proves nothing. */
  | 'default-omitted'
  /** The class or the check is `TOOLS_ENABLED`. */
  | 'editor-only'
  /**
   * The `push_back` is live source, but no value of the field satisfies it, so Godot never raises it. The decline
   * names the line that makes the state unreachable.
   */
  | 'engine-unreachable';

export type Verdict =
  /** The `ruleName` a rule emits for this exact condition. */
  | { readonly rule: string }
  /**
   * Already reported by a format validator rather than a rule, given as `Type.key`. The obligation is that an author is
   * told: Godot warns on a `LineEdit.secret_character` longer than one character, and `secretCharacterValidator` already
   * rejects it at error tier, so a warning-tier rule beside it would report one defect twice.
   */
  | { readonly validator: string }
  /** Not checkable from one `.tscn`, for a reason of the named kind. */
  | { readonly declined: DeclineCategory; readonly because: string }
  /**
   * Checkable from a `.tscn`, and not yet checked: a live gap, not a decision. It keeps the guard green while naming every
   * outstanding obligation, and the string names what the rule would check. Entries leave this arm only for `rule`.
   */
  | { readonly unimplemented: string };

export interface WarningRow {
  /** `file.cpp:line` of the `warnings.push_back`, in the 4.6.3 tree. */
  readonly at: string;
  /** What Godot tells the author, compressed to a clause. */
  readonly says: string;
  readonly verdict: Verdict;
  /**
   * The visibility check Godot wraps around this `push_back`, if any. Absent means it warns regardless, per row, not per
   * class. `visible` is the node's own flag (`node_3d.cpp:1127-1130`), answered by `isExplicitlyHidden`. `visible-in-tree`
   * is the cascade (`node_3d.cpp:1131-1143` for Node3D, `canvas_item.cpp:62-64` for CanvasItem) that `visibleInTreeVerdict`
   * in `parentType.ts` reproduces. No guard checks the gate: each slice's `linter.test.ts` holds a hidden-node case.
   */
  readonly gate?: 'visible-in-tree' | 'visible';
  /**
   * The concrete types this row reaches, when not every descendant: each override opens with
   * `PackedStringArray warnings = <Parent>::get_configuration_warnings();`, except where a `get_class() == "Container"` guard
   * confines it (`container.cpp:210`), a fresh `PackedStringArray warnings;` skips the parent (`openxr_render_model.cpp:147`,
   * `openxr_render_model_manager.cpp:200`), or this repo splits one condition per family (`area*`, `staticbody*`, `characterbody*`, `rigidbody*`).
   */
  readonly appliesTo?: readonly string[];
}
