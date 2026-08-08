/**
 * The row shape the configuration-warning census is written in.
 *
 * Split out from `configurationWarningCensus.ts` so the family parts beside this
 * file can import the types without importing the table that assembles them.
 * The census header is where a row's derivation, the decline categories and the
 * re-derivation recipe are explained; this file is only the shape.
 */

export type DeclineCategory = 'runtime-only' | 'instance-opaque' | 'default-omitted' | 'editor-only';

export type Verdict =
  /** The `ruleName` a rule emits for this exact condition. */
  | { readonly rule: string }
  /**
   * Already reported, but by a format validator rather than a rule — given as
   * `Type.key`.
   *
   * The obligation is that an author is TOLD, not that a `LintRule` exists.
   * `LineEdit.secret_character` is the case that forced this: Godot warns when
   * more than one character is given, and `secretCharacterValidator` already
   * rejects exactly that, at error tier. Adding a warning-tier rule beside it
   * would report one defect twice and weaken it, so the honest verdict is
   * "covered, elsewhere" rather than a third state that reads as a gap.
   */
  | { readonly validator: string }
  /** Not checkable from one `.tscn`, for a reason of the named kind. */
  | { readonly declined: DeclineCategory; readonly because: string }
  /**
   * Checkable from a `.tscn`, and not yet checked. A live gap, not a decision.
   *
   * This arm exists so the guard can ship green while still naming every
   * outstanding obligation — the alternative is a red suite, which gets disabled.
   * The string names what the rule would check, so the list doubles as the work
   * queue it was derived from. Entries only ever leave this arm for `rule`.
   */
  | { readonly unimplemented: string };

export interface WarningRow {
  /** `file.cpp:line` of the `warnings.push_back`, in the 4.6.3 tree. */
  readonly at: string;
  /** What Godot tells the author, compressed to a clause. */
  readonly says: string;
  readonly verdict: Verdict;
  /**
   * The visibility check Godot wraps around this `push_back`, when there is one.
   *
   * Ten of the 92 overrides gate part of their body on visibility, and the two
   * spellings are different rules, not synonyms:
   *
   * - `visible` is the node's OWN flag (`node_3d.cpp:1127-1130`), so
   *   `isExplicitlyHidden` answers it with no walk at all;
   * - `visible-in-tree` is the family cascade (`node_3d.cpp:1131-1143` for
   *   Node3D, `canvas_item.cpp:62-64` for CanvasItem), which `parentType.ts`'s
   *   `visibleInTreeVerdict` reproduces.
   *
   * Absence means Godot raises the warning regardless of visibility. That is
   * per-`push_back`, not per-class: `XROrigin3D` and `OpenXRCompositionLayer`
   * each gate some of their rows and leave the rest unconditional.
   *
   * A gate reaches the same leaves the row does, since it is the same override
   * body every heir inherits. Nothing here asserts it — a table checked against
   * a declaration would be true by construction and would never see a hidden
   * node still warning. The rules are held to it by a hidden-node case in each
   * slice's own `linter.test.ts`; this column is the derivation record that
   * says which slices owe one.
   */
  readonly gate?: 'visible-in-tree' | 'visible';
  /**
   * The concrete types this row reaches, when that is NOT every descendant of
   * the declaring class.
   *
   * Every override in the tree opens with
   * `PackedStringArray warnings = <Parent>::get_configuration_warnings();`, so a
   * base class's warnings normally do reach every leaf. Three things break that,
   * and all three need spelling out here rather than being left to a reader:
   *
   * - a guard of the form `if (get_class() == "Container")`, which confines the
   *   row to the base class itself (`container.cpp:210`);
   * - an override that starts a FRESH `PackedStringArray warnings;` and never
   *   calls its parent, which cuts that leaf off from the base's rows —
   *   `OpenXRRenderModel` (`openxr_render_model.cpp:147`) and
   *   `OpenXRRenderModelManager` (`openxr_render_model_manager.cpp:200`) are the
   *   only two in the closure that do this;
   * - this repo implementing ONE Godot condition as several rules, one per
   *   concrete family, rather than one rule with a base-walking matcher — the
   *   `CollisionObject2D`/`CollisionObject3D` "needs a collision shape" warning
   *   is four separate rule names (`area*`, `staticbody*`, `characterbody*`,
   *   `rigidbody*`), each reaching only its own family, so the single Godot row
   *   becomes several `WarningRow`s here, each with its own slice of `appliesTo`.
   */
  readonly appliesTo?: readonly string[];
}
