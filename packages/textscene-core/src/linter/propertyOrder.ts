/**
 * Flags a target property authored before a trigger whose setter overwrites it.
 * `SceneState::instantiate` sets properties in file order on the orphan node
 * (`scene/resources/packed_scene.cpp:491-492`, parented at `:541`, ADR-0035). It
 * compares order only, so it also flags a value that survives by coincidence.
 */

/**
 * Which of `targets` come before the latest trigger present in `properties`. One
 * trigger after a target is enough: `Range`'s `value` between `min_value` and
 * `max_value` clamps against the stale default `max`, and the later `max_value`
 * only re-clamps that result.
 *
 * @param properties A node's raw bag (`TscnNode.properties` in the strict parser,
 *   `TscnNode.rawProperties` in the lenient one). Its string keys iterate in file
 *   order, because `TscnParserCore.ts` assigns each key once, in scan order.
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
