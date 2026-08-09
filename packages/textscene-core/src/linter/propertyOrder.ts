/**
 * Property-order hazard detection — shared by every slice `linter.ts` that
 * flags a `.tscn` node authoring properties in a file order Godot's own
 * property setters silently discard.
 *
 * `SceneState::instantiate` applies a node's properties in FILE order while
 * the node is still an orphan (`node->set(...)`,
 * `scene/resources/packed_scene.cpp:491-492`, before the `_add_child_nocheck`
 * that parents it at `:541` — see ADR-0035). A property whose setter has a
 * side effect on a sibling ("trigger") property therefore sees, and can
 * silently overwrite, whatever the sibling ("target") property was already
 * set to. Two Godot classes exercise this shape today (`Control`'s
 * `anchors_preset`, `Range`'s `min_value`/`max_value`/`page`); this module is
 * the one place the ORDER ARITHMETIC lives, so a third does not reimplement
 * it.
 *
 * Pure order comparison only — it does not simulate a setter's actual
 * clamp/overwrite math, so it flags every "target before a trigger" ordering
 * regardless of whether the specific values involved would differ after the
 * trigger runs. That mirrors both callers' own choice: an authoring hazard is
 * worth a warning even when this particular value happens to survive by
 * coincidence (e.g. an authored offset that happens to equal what the preset
 * would have derived anyway).
 */

/**
 * Which of `targets` are authored before the LATEST-positioned `trigger` that
 * is actually present in `properties`.
 *
 * "Latest trigger", not "any"/"every" trigger, because a target is at risk
 * the moment even ONE trigger runs after it — e.g. `Range`'s `value` written
 * between `min_value` (before) and `max_value` (after) is still corrupted: it
 * clamps against the stale default `max` when `value`'s own setter runs, and
 * the LATER `max_value` only re-clamps the already-corrupted result, never
 * restoring the original intent. A target is safe only once it comes after
 * every present trigger, i.e. after the latest one.
 *
 * `properties` is a node's raw `Record<string, string>` bag (`TscnNode.properties`
 * for the strict parser, `TscnNode.rawProperties` for the lenient one) — a
 * plain object whose non-numeric string keys iterate in insertion order,
 * which is file order (`TscnParserCore.ts` assigns each key once, in scan
 * order; see ADR-0035's "Where order would be captured").
 */
export function targetsBeforeLatestTrigger(
  properties: Record<string, string>,
  targets: readonly string[],
  triggers: readonly string[]
): string[] {
  const keys = Object.keys(properties);
  const triggerIndices = triggers
    .map((trigger) => keys.indexOf(trigger))
    .filter((index) => index !== -1);
  if (triggerIndices.length === 0) return [];

  const latestTriggerIndex = Math.max(...triggerIndices);
  return targets.filter((target) => {
    const index = keys.indexOf(target);
    return index !== -1 && index < latestTriggerIndex;
  });
}
