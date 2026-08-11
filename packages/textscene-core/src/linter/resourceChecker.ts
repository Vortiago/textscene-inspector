/**
 * Resource-reference questions the semantic linter rules ask.
 *
 * Both answers come from `parseResourceReference`/`findSubResource` rather than
 * a local regex. The grammar had drifted into five private copies across core,
 * disagreeing on both the id character class and whether `SubResource( "x" )`
 * spacing is legal — so the same reference could resolve for the renderer and
 * read as missing to a lint rule.
 */

import type { TscnScene } from '../parser/types.js';
import { findSubResource, parseResourceReference } from '../resources/SubResourceResolver.js';

/**
 * The declared type of whatever a reference names — `'BoxShape3D'`,
 * `'ConcavePolygonShape3D'`, `'Texture2D'` — or undefined when the value is not
 * a resource reference or names nothing in this scene.
 *
 * @param scene - the parsed scene the reference is resolved against.
 * @param resourceRef - a raw property value, e.g. `SubResource("Box_1")`.
 */
export function referencedResourceType(
  scene: TscnScene,
  resourceRef: string | undefined
): string | undefined {
  return resolveReference(scene, resourceRef)?.type;
}

/** The declared resource a reference names, or undefined. */
function resolveReference(
  scene: TscnScene,
  resourceRef: string | undefined
): { type: string } | undefined {
  const parsed = resourceRef ? parseResourceReference(resourceRef) : null;
  if (!parsed) return undefined;
  return parsed.type === 'SubResource'
    ? findSubResource(scene.internalResources ?? [], parsed.id)
    : scene.externalResources?.find((r) => r.id === parsed.id);
}

/**
 * An explicitly CLEARED resource slot, written as a bare `null`.
 *
 * Distinct from an absent key and from a dangling reference: the author said
 * "no resource here", and `variant_parser.cpp:699` reads it as `Variant()`,
 * which every `Ref<T>` setter takes. See `createResourceReferenceValidator`
 * for the format half of the same rule.
 */
export function isClearedResource(resourceRef: string | undefined): boolean {
  return resourceRef?.trim() === 'null';
}

/**
 * Whether a reference is anything OTHER than a dangling one.
 *
 * A malformed reference is `false` here rather than throwing — its format is
 * the strict parser's job, and reporting it twice would double the diagnostic.
 *
 * A CLEARED slot is `true`, because it names nothing on purpose. Every caller
 * uses this to decide whether to report a missing resource, and `null` is a
 * value Godot writes and reloads, so reporting it is a false positive on a file
 * the engine opens. The guard lives here rather than at the two dozen call
 * sites for the same reason the format half lives at its combinator: the rule
 * is general, and the sites that hand-rolled it disagreed.
 *
 * @example
 * ```typescript
 * if (!checkResourceExists(scene, 'SubResource("mesh_1")')) {
 *   // Report error: resource not found
 * }
 * ```
 */
export function checkResourceExists(scene: TscnScene, resourceRef: string): boolean {
  if (isClearedResource(resourceRef)) return true;
  return resolveReference(scene, resourceRef) !== undefined;
}
