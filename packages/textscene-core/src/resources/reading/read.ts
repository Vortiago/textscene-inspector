/**
 * What a reader of a resource names and what it gets back: a kind decodes one family of Godot
 * classes for every origin, and a read answers with the value or with why there is none. No THREE
 * and no React.
 */

import type { FileKind } from '../fileKinds';
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
 * file, so it has no properties, and its address is the file. A kind that reads its files whole
 * holds the class the `[ext_resource]` states instead.
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
  /**
   * True for a kind whose files a loader processor reads whole, through {@link Follow.loaded}. The
   * snapshot then parses no such file: it holds it with no properties and the class its
   * `[ext_resource]` states, so the read waits for one file, not for the parse and then the value.
   */
  readonly readsFilesWhole?: boolean;
  /** Pure and synchronous. Null declines the resource (`undecodable`). */
  readonly decode: (held: HeldResource, follow: Follow) => T | null;
}

/** How a decode follows a reference written in the resource it decodes. */
export interface Follow {
  /** Decodes the nested resource now. It resolves in the holder's tables, and the holder joins the chain. */
  read<U>(kind: ResourceKind<U>, ref: string | undefined): Read<U>;
  /**
   * {@link Follow.read}, but a pending answer does not make the holder wait. For a part the value
   * draws without until it arrives, as a Font draws its base face while a fallback loads.
   */
  readWithoutWaiting<U>(kind: ResourceKind<U>, ref: string | undefined): Read<U>;
  /** The same reference, not read: for a value a consumer reads later (a surface's material). */
  reference(ref: string | undefined): ScopedReference;
  /** The value a loader processor built for the holder's own address. `none` for a holder with no address. */
  loaded<U extends object>(fileKind: FileKind<U>): Read<U>;
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
  /** The value a loader processor built for `address`: for a bare path that no reference names. */
  loaded<U extends object>(fileKind: FileKind<U>, address: string): Read<U>;
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
