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
import { isNilLiteral } from '../godot/index.js';

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
 * An explicitly CLEARED resource slot, written as a bare `null` or `nil`.
 *
 * Distinct from an absent key and from a dangling reference: the author said
 * "no resource here", and `variant_parser.cpp:699` reads BOTH identifiers
 * through one arm to `Variant()`, which every `Ref<T>` setter takes. See
 * `createResourceReferenceValidator` for the format half of the same rule.
 */
export function isClearedResource(resourceRef: string | undefined): boolean {
  return resourceRef !== undefined && isNilLiteral(resourceRef);
}

/**
 * Whether a resource slot holds NOTHING — the question every "this node needs a
 * resource" rule is actually asking.
 *
 * Four spellings, one state: the key is absent, the value is empty, or the
 * author wrote a bare `null` or `nil`. Godot cannot tell them apart — all reach
 * the `Ref<T>` as an invalid reference (`variant_parser.cpp:699` reads either
 * identifier as `Variant()`), so every `is_null()` in a
 * `get_configuration_warnings()` answers the same for all of them.
 *
 * It lives here rather than at the two dozen call sites because the sites that
 * hand-rolled it drifted the same way: `'null'` is a TRUTHY string, so `!ref`
 * steps over it and `checkResourceExists` then reports the slot as fine, leaving
 * the node silently unreported. `clearedResourceSlot.test.ts` holds the
 * spellings to one answer.
 */
export function resourceSlotIsEmpty(resourceRef: string | undefined): boolean {
  return !resourceRef?.trim() || isClearedResource(resourceRef);
}

/**
 * The reference a slot actually holds, or `undefined` when it holds nothing.
 *
 * The same question as {@link resourceSlotIsEmpty}, answered as a value so a
 * rule can branch and then USE it. Three slices had already hand-rolled this
 * shape; the point of naming it is that the empty test and the value that
 * survives it can no longer disagree.
 */
export function heldResource(resourceRef: string | undefined): string | undefined {
  return resourceSlotIsEmpty(resourceRef) ? undefined : resourceRef;
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
