/**
 * Resource-slice registration — the routing claim table (ADR-0031).
 *
 * Every resource slice declares here which TSCN type names and file
 * extensions it claims, which processor slot (bus tag) serves it, and how a
 * failed load is labelled. Routing derives from these claims; nothing may
 * guess a bus tag from a type-name substring (the `busTypeFor` pattern this
 * replaces).
 *
 * Deliberately THREE-free and React-free: linter entry points and other claim
 * consumers must be able to read the table without pulling a renderer into
 * their import closure (the `buildableMaterialTypes` precedent).
 *
 * Population follows the NodeRegistry pattern: each slice's `index.ts` calls
 * `registerResourceSlice` as a side effect, and the aggregation barrel
 * (`sliceRegistrations.ts`) imports every slice index.
 */

/**
 * The processor slots, named for the cached artifact they produce. A slice
 * claims the slot whose artifact kind it resolves to; several Godot-text
 * types share the generic `resource` slot (a ParsedResource) and give it
 * meaning in their own decode.
 */
export type ResourceBusType =
  | 'texture'
  | 'material'
  | 'scene'
  | 'glb'
  | 'resource'
  | 'arraymesh'
  // The loader serves these two through their own processors rather than a
  // registered slice, so no claim carries them — but they are bus tags all the
  // same, and this union is what `ResourceEventBus` aliases.
  | 'font'
  | 'theme';

export interface ResourceSliceRegistration {
  /** Slice folder name under `resources/<category>/`, e.g. 'standardmaterial3d'. */
  slice: string;
  /**
   * `godot-text`: decodes a ParsedResource section via pure decode/build.
   * `foreign-format`: declares its real parser (glTF, image decoder, …).
   */
  kind: 'godot-text' | 'foreign-format';
  /** TSCN type names this slice decodes (`type=` of ext/sub resources). */
  typeNames: readonly string[];
  /** File extensions this slice's byte layer claims (foreign-format slices). */
  extensions?: readonly string[];
  /** Whether the provider must fetch bytes (not text) for this slice's files. */
  binaryBytes?: boolean;
  /**
   * Which processor slot serves this slice's claims. Null for the types the
   * loader never serves (ViewportTexture resolves by NodePath, not by file).
   */
  busType: ResourceBusType | null;
  /** Missing-resources row label for a failed load of this slice's claims. */
  failureLabel: string;
}

const byTypeName = new Map<string, ResourceSliceRegistration>();
const byExtension = new Map<string, ResourceSliceRegistration>();
const all: ResourceSliceRegistration[] = [];

export function registerResourceSlice(registration: ResourceSliceRegistration): void {
  for (const typeName of registration.typeNames) {
    const existing = byTypeName.get(typeName);
    if (existing && existing.slice !== registration.slice) {
      throw new Error(
        `Resource type "${typeName}" is already claimed by slice "${existing.slice}" ` +
          `(re-claimed by "${registration.slice}")`
      );
    }
    byTypeName.set(typeName, registration);
  }
  for (const extension of registration.extensions ?? []) {
    const existing = byExtension.get(extension);
    if (existing && existing.slice !== registration.slice) {
      throw new Error(
        `Extension "${extension}" is already claimed by slice "${existing.slice}" ` +
          `(re-claimed by "${registration.slice}")`
      );
    }
    byExtension.set(extension, registration);
  }
  all.push(registration);
}

export const resourceSliceRegistry = {
  byTypeName: (typeName: string): ResourceSliceRegistration | null =>
    byTypeName.get(typeName) ?? null,
  byExtension: (extension: string): ResourceSliceRegistration | null =>
    byExtension.get(extension) ?? null,
  /** The routing answer `busTypeFor` used to guess: null means unroutable. */
  busTypeFor: (typeName: string): ResourceBusType | null =>
    byTypeName.get(typeName)?.busType ?? null,
  all: (): readonly ResourceSliceRegistration[] => all,
};
