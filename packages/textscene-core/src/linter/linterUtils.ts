/** Small shared helpers for node-type semantic linters. */

/**
 * Narrow a node's `properties` to a string-keyed record before reading raw
 * values in a semantic rule. Was duplicated verbatim in every node-type
 * `linter.ts` (architecture review S-2).
 */
export function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}
