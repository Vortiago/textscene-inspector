/**
 * The id each re-homed reference had in the file that wrote it. `rehomeOverride` renames an
 * id the target scope already holds, and the inspector spells the reference as its file did,
 * since Godot keeps one table per file and shows no rename.
 */
import { renameResourceRefs, type ResourceRef } from '../godot/resourceRef.js';

/** Per reference kind, each id in the node's scope mapped to the id its own file wrote. */
export type AuthoredIds = Readonly<Record<ResourceRef['kind'], ReadonlyMap<string, string>>>;

/** `text` with each renamed reference spelled as its own file wrote it. */
export function authoredSpelling(text: string, ids: AuthoredIds | undefined): string {
  if (!ids) return text;
  return renameResourceRefs(text, (ref) => ids[ref.kind].get(ref.id) ?? ref.id);
}

/** `later` renamed ids that `earlier` names, so each traces back to the first file's id. */
export function composeAuthoredIds(
  earlier: AuthoredIds | undefined,
  later: AuthoredIds | undefined
): AuthoredIds | undefined {
  if (!earlier || !later) return earlier ?? later;
  const compose = (kind: ResourceRef['kind']): Map<string, string> => {
    const out = new Map(earlier[kind]);
    for (const [id, renamedFrom] of later[kind]) out.set(id, earlier[kind].get(renamedFrom) ?? renamedFrom);
    return out;
  };
  return { ExtResource: compose('ExtResource'), SubResource: compose('SubResource') };
}

/** The renames of two sets of references that share one scope but came from different files. */
export function unionAuthoredIds(
  a: AuthoredIds | undefined,
  b: AuthoredIds | undefined
): AuthoredIds | undefined {
  if (!a || !b) return a ?? b;
  return {
    ExtResource: new Map([...a.ExtResource, ...b.ExtResource]),
    SubResource: new Map([...a.SubResource, ...b.SubResource]),
  };
}
