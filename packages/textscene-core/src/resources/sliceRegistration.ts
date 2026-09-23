/**
 * The resource-slice routing claim table (ADR-0031): each slice's type names,
 * file extensions, processor slot and failure label. Routing derives from these
 * claims, never from a type-name substring. THREE-free and React-free, so a
 * linter entry point can read it. Each slice's `index.ts` registers itself.
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
  | 'font'
  | 'theme';

export interface ResourceSliceRegistration {
  /** Slice folder name under `resources/<category>/`, for example 'standardmaterial3d'. */
  slice: string;
  /**
   * `godot-text`: decodes a ParsedResource section with pure decode and build.
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
   * Whether a cached value is shared scene-graph state that each consumer must
   * clone (an `Object3D` has one parent). Read by `useResource` per bus.
   */
  clonePerConsumer?: boolean;
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
  /** The processor slot for a type name. Null means unroutable. */
  busTypeFor: (typeName: string): ResourceBusType | null =>
    byTypeName.get(typeName)?.busType ?? null,
  /** Whether the slice claiming `busType` marks its values clone-per-consumer. */
  clonesPerConsumer: (busType: ResourceBusType): boolean =>
    all.some((r) => r.busType === busType && r.clonePerConsumer === true),
  all: (): readonly ResourceSliceRegistration[] => all,
};
