/**
 * Resource-reference questions the semantic linter rules ask.
 *
 * Every answer comes from `parseResourceReference`/`findSubResource` rather than
 * a local regex. The grammar had drifted into five private copies across core,
 * disagreeing on both the id character class and whether `SubResource( "x" )`
 * spacing is legal — so the same reference could resolve for the renderer and
 * read as missing to a lint rule.
 */

import type { TscnScene } from '../parser/types.js';
import { findSubResource, parseResourceReference } from '../resources/SubResourceResolver.js';
import { isNilLiteral } from '../godot/index.js';

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
 * What a resource slot holds, as the one state it is in.
 *
 * Four states, because only ONE of them owes a "resource not found":
 *
 * - `empty` — absent, blank, or cleared. {@link resourceSlotIsEmpty}'s question.
 * - `not-a-reference` — a value that names no id at all. `variant_parser.cpp:1089`
 *   takes only the `Resource` / `SubResource` / `ExtResource` identifiers into
 *   the resource arm, so `shape = "hello"` asks for no resource and its format
 *   is the strict parser's diagnostic.
 * - `dangling` — a well-formed reference whose id this file never declares.
 *   `resource_format_text.cpp:113` fails the load on it
 *   (`ERR_FAIL_COND_V(!int_resources.has(id), ERR_INVALID_PARAMETER)`); the
 *   ext-resource half is the `ERR_PARSE_ERROR` at `:138`.
 * - `resolved` — the declared type the id names, e.g. `'ConcavePolygonShape3D'`.
 *
 * A `type` exists only in the `resolved` arm, so "not a reference" can no
 * longer be read as "names nothing". Sharing one `undefined` between the two
 * makes the rule reading it report a missing resource nobody asked for.
 */
export type ResourceSlot =
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-a-reference' }
  | { readonly kind: 'dangling' }
  | { readonly kind: 'resolved'; readonly type: string };

/**
 * Resolve a raw property value against the scene's resource tables, once.
 *
 * The single scan the rules branch on, and the one {@link checkResourceExists}
 * is derived from — so the boolean and the states can never disagree.
 *
 * @param scene - the parsed scene the reference is resolved against.
 * @param resourceRef - a raw property value, e.g. `SubResource("Box_1")`.
 */
export function resolveResourceSlot(
  scene: TscnScene,
  resourceRef: string | undefined
): ResourceSlot {
  const held = heldResource(resourceRef);
  if (held === undefined) return { kind: 'empty' };
  const parsed = parseResourceReference(held);
  if (parsed === null) return { kind: 'not-a-reference' };
  const declared =
    parsed.type === 'SubResource'
      ? findSubResource(scene.internalResources ?? [], parsed.id)
      : scene.externalResources?.find((r) => r.id === parsed.id);
  return declared ? { kind: 'resolved', type: declared.type } : { kind: 'dangling' };
}

/**
 * Whether a reference is anything OTHER than a dangling one.
 *
 * A value that is not a reference at all is `true`: only a WELL-FORMED
 * reference can dangle. Its format is the strict parser's diagnostic, and
 * answering `false` here put a second, factually wrong error beside it —
 * `shape = "hello"` reported that a resource named `hello` was missing, when
 * nothing had asked for one.
 *
 * A CLEARED slot is `true`, because it names nothing on purpose: `null` is a
 * value Godot writes and reloads. The dangling case itself is
 * `danglingResources.ts`'s error for every registered slot; this answers a
 * rule that gates something ELSE on a reference resolving (Path2D's script
 * exemption).
 *
 * @example
 * ```typescript
 * if (!checkResourceExists(scene, 'SubResource("mesh_1")')) {
 *   // Report error: resource not found
 * }
 * ```
 */
export function checkResourceExists(scene: TscnScene, resourceRef: string): boolean {
  return resolveResourceSlot(scene, resourceRef).kind !== 'dangling';
}
