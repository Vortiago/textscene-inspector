/**
 * Resource-reference questions the semantic linter rules ask. Every answer comes
 * from `parseResourceReference`, `findSubResource` and `findExtResource`, not a
 * local regex or scan, so a reference cannot resolve for the renderer and read as
 * missing to a rule.
 */

import type { TscnScene } from '../parser/types.js';
import {
  findExtResource,
  findSubResource,
  parseResourceReference,
} from '../resources/SubResourceResolver.js';
import { isNilLiteral } from '../godot/index.js';

/**
 * An explicitly cleared resource slot, a bare `null` or `nil`: the author said
 * "no resource here". `variant_parser.cpp:699` reads both identifiers to
 * `Variant()`, which every `Ref<T>` setter takes. `createResourceReferenceValidator`
 * holds the format half of the same rule.
 */
export function isClearedResource(resourceRef: string | undefined): boolean {
  return resourceRef !== undefined && isNilLiteral(resourceRef);
}

/**
 * Whether a resource slot holds nothing: absent, empty, `null` or `nil`, which
 * all reach the `Ref<T>` as invalid (`variant_parser.cpp:699`). Use this, not
 * `!ref`: `'null'` is a truthy string. `clearedResourceSlot.test.ts` holds the
 * spellings to one answer.
 */
export function resourceSlotIsEmpty(resourceRef: string | undefined): boolean {
  return !resourceRef?.trim() || isClearedResource(resourceRef);
}

/**
 * The reference a slot holds, or `undefined` when it holds nothing: the
 * {@link resourceSlotIsEmpty} question answered as a value a rule can use.
 */
export function heldResource(resourceRef: string | undefined): string | undefined {
  return resourceSlotIsEmpty(resourceRef) ? undefined : resourceRef;
}

/**
 * What a resource slot holds. Only `dangling` owes a "resource not found", and
 * only `resolved` has a `type`, so "not a reference" never reads as "names nothing".
 */
export type ResourceSlot =
  // Absent, blank, or cleared: {@link resourceSlotIsEmpty}'s question.
  | { readonly kind: 'empty' }
  // `variant_parser.cpp:1089` takes only `Resource`, `SubResource` and
  // `ExtResource` into the resource arm, so `shape = "hello"` asks for no
  // resource. Its format is the strict parser's diagnostic.
  | { readonly kind: 'not-a-reference' }
  // An undeclared id: `resource_format_text.cpp:113` fails the load
  // (`ERR_FAIL_COND_V(!int_resources.has(id), ERR_INVALID_PARAMETER)`), and the
  // ext-resource half is the `ERR_PARSE_ERROR` at `:138`.
  | { readonly kind: 'dangling' }
  // The declared type the id names, such as `'ConcavePolygonShape3D'`.
  | { readonly kind: 'resolved'; readonly type: string };

/**
 * Resolve a raw property value against the scene's resource tables, once. The
 * rules branch on this answer, and {@link checkResourceExists} derives from it.
 *
 * @param scene - the parsed scene the reference is resolved against.
 * @param resourceRef - a raw property value, such as `SubResource("Box_1")`.
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
      : findExtResource(scene.externalResources ?? [], parsed.id);
  return declared ? { kind: 'resolved', type: declared.type } : { kind: 'dangling' };
}

/**
 * Whether a reference is anything other than a dangling one. A non-reference and
 * a cleared slot are both `true`: only a well-formed reference can dangle. The
 * dangling error is `danglingResources.ts`'s. This serves a rule that gates
 * something else on a resolving reference, such as Path2D's script exemption.
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
