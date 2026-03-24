/** Shared linter utilities */

/** Type guard for validating node properties are a string record */
export function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}
