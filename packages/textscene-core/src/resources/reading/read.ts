/**
 * What a reader of a resource names and what it gets back: a kind decodes one family of Godot
 * classes for every origin, and a read answers with the value or with why there is none. No THREE
 * and no React.
 */

import type { ScopedReference } from './scopedReference';

/** What a read answers. `value` is non-null only for `loaded`. */
export type Read<T> =
  | { readonly status: 'loaded'; readonly value: T }
  /** The property holds no resource. Godot draws nothing. */
  | { readonly status: 'none'; readonly value: null }
  /** A file the read needs has not arrived. The caller runs again when it does. */
  | { readonly status: 'pending'; readonly value: null }
  | { readonly status: 'unavailable'; readonly value: null; readonly reason: UnavailableReason };

export type UnavailableReason = 'missing-file' | 'unknown-id' | 'wrong-type' | 'undecodable' | 'cycle';

/**
 * The class of a held resource that is a file the loader imports, such as an image: no resource
 * file, so it has no properties, and its address is the file.
 */
export const IMPORTED_FILE = 'ImportedFile';

/** A resource as a decode receives it. It exposes no table. */
export interface HeldResource {
  /** The Godot class, or {@link IMPORTED_FILE}. */
  readonly type: string;
  /** The raw value strings of the resource. */
  readonly properties: Readonly<Record<string, string>>;
  /** The loader key: a file path or a **Sub-resource path** (ADR-0046). Null for a resource built into a scene. */
  readonly address: string | null;
  /** The resource's own `resource_local_to_scene`, with the default of its class. */
  readonly isLocalToScene: boolean;
  /** False once a holder passed on the way is not local to scene. */
  readonly isHeldLocally: boolean;
}

/** One decode for one family of Godot classes, for every origin. */
export interface ResourceKind<T> {
  readonly name: string;
  /** The classes the decode accepts. Any other class answers `wrong-type`. */
  readonly accepts: (type: string) => boolean;
  /** Pure and synchronous. Null declines the resource (`undecodable`). */
  readonly decode: (held: HeldResource, follow: Follow) => T | null;
}

/** How a decode follows a reference written in the resource it decodes. */
export interface Follow {
  /** Decodes the nested resource now. It resolves in the holder's tables, and the holder joins the chain. */
  read<U>(kind: ResourceKind<U>, ref: string | undefined): Read<U>;
  /** The same reference, not read: for a value a consumer reads later (a surface's material). */
  reference(ref: string | undefined): ScopedReference;
}

/**
 * `ref` handed on as a reference, or null for a property that names nothing. A decode that hands
 * on no reference keeps no tables, so its value is shared across the scopes that read it.
 *
 * @canonical An optional reference a decode hands on
 */
export function optionalReference(follow: Follow, ref: string | undefined): ScopedReference | null {
  return ref === undefined ? null : follow.reference(ref);
}

/** One consistent view of what the loader holds. Every read records the files it touched. */
export interface ResourceSnapshot {
  read<T>(reference: ScopedReference, kind: ResourceKind<T>): Read<T>;
}

export const NONE: Read<never> = { status: 'none', value: null };

export const PENDING: Read<never> = { status: 'pending', value: null };

/** One answer object for each reason, so an unchanged answer keeps its identity. */
export const UNAVAILABLE: Readonly<Record<UnavailableReason, Read<never>>> = {
  'missing-file': { status: 'unavailable', value: null, reason: 'missing-file' },
  'unknown-id': { status: 'unavailable', value: null, reason: 'unknown-id' },
  'wrong-type': { status: 'unavailable', value: null, reason: 'wrong-type' },
  undecodable: { status: 'unavailable', value: null, reason: 'undecodable' },
  cycle: { status: 'unavailable', value: null, reason: 'cycle' },
};
