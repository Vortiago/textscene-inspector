# A sub-resource path addresses a resource inside a `.tres`

- Status: Accepted (2026-07-28)
- Related: the `resource event bus` / `useResource` seam (ARCHITECTURE.md "Resource
  Loading"), ADR-0022 (uploads are frontend-only), ADR-0028 (import sidecars).
- Closes the "two unjoined halves" gap recorded in
  `packages/textscene-core/src/resources/meshes/comparison.md`.

## Context

A material-, mesh- or texture-valued slot can carry three kinds of reference, and until
now only two of them resolved:

1. `ExtResource` pointing at a `.tres` — the path-keyed resource pipeline handles it.
2. `SubResource` of the **previewed** `.tscn` — `SceneResourcesContext` plus
   `resolveStandardMaterial` handle it synchronously, since the body is already parsed.
3. `SubResource` of some **other** `.tres` the scene pulled in — nothing handled it.

Kind 3 is not exotic: Godot writes it whenever a mesh carries its own materials rather
than referencing shared ones, which covered 20 of the corpus's 43 ArrayMesh surface
materials, so every Truck Town vehicle rendered untinted grey.

Nothing was missing in capability. `parseTresFile` already returned the file's
`subResources`, and `tileSetFromTres` already read a sub-resource out of an external
`.tres`. What blocked kind 3 was that it had **no name a cache could be keyed on**:
`ArrayMeshResource.materialPaths` is `(string | null)[]`, `ExternalMaterialSlot` takes a
`path`, and the material pipeline decided "is this a material" from a file extension.

Two shapes were weighed:

- **(A) Address the sub-resource with a path.** Give kind 3 a string, so the existing
  path-keyed machinery — processor cache, in-flight dedupe, failure-cached-as-null,
  `useResource`'s LRU pinning, the missing-resources panel — keeps working with no
  consumer change and no signature change.
- **(B) A resolved-descriptor type.** A small union ("material from path" / "material
  from these properties plus this owning file's ext_resource table"), produced by a
  shared resolver and consumed by one component.

## Decision

Adopt (A), with the grammar Godot itself uses: **`res://file.tres::SubId`**. Godot's
text saver writes exactly that as the path of every `[sub_resource]`, and
`ResourceLoader.load()` accepts it — so this is the domain's notation, not an invention.

Two rules make it safe, and they are the whole of the design:

- **The whole address is the resource identity.** It is the processor cache key, the
  in-flight key, and what `useResource` pins and subscribes to. Two consumers of one
  sub-resource therefore share one `THREE.Material` by identity, as they already do for
  a whole-file material.
- **Only `filePath` reaches the byte layer.** `createResourceProcessor` normalises the
  address before calling `fileEventBus.request`, so no `ResourceProvider`, upload
  (ADR-0022), hot-reload watcher or missing-resources row ever sees a string that is not
  a real file. The bytes of a sub-resource *are* the bytes of the file that owns it.

The normalisation lives in `createResourceProcessor`, not in `FileEventBus`, for three
reasons: the byte bus is deliberately type-agnostic and must stay so; a `shouldProcess`
predicate is a question about a FILE (`path.endsWith('.tres')`) and would break if handed
an address; and one arrival can settle several addresses, which is bookkeeping the
processor already owns. Doing it there also means **every** processor type gains the
capability at once rather than the material one specially — which is what makes the seam
invisible to a future slice author.

(B) lost on the "hidden" criterion. It is more explicit, but every consumer would learn a
new type, and the three kinds would stay three kinds in the type system — so a new slice
would still have to know that kind 3 exists in order to handle it. It would also
duplicate the caching, dedupe and failure semantics the processor already provides, or
give kind 3 different ones.

## Consequences

- `parseSubResourcePath` / `subResourcePath` / `resourceFilePath`
  (`resources/subResourcePath.ts`) are the only place the `::` grammar is written.
- `decodeArrayMesh` and `meshLibraryFromTres` take the path they were loaded from,
  because a sub-resource can only be addressed relative to its own file. Both then emit
  ordinary path strings; `MeshInstance3D`, `ExternalMaterialSlot` and `GridMap` needed no
  change at all, which is the check that the seam is genuinely hidden.
- A sub-resource's own texture `ExtResource`s resolve against the **owning `.tres`'s**
  table. Getting this wrong would silently sample the scene's texture of the same id, so
  it is pinned by its own test.
- `decodeArrayMesh` honours an address too, so a `[sub_resource type="ArrayMesh"]` (a
  `shadow_mesh`, a MeshLibrary's embedded item mesh) reads its own `_surfaces`. Without
  that it would have fallen through to the file's `[resource]` body and returned a
  *different mesh* under the right-looking name — a wrong answer, not a missing one.
- A per-path `clearCache` now also drops, and announces `invalidated` for, the addresses
  into that file. A **Dependency hot-reload** re-requests only the file it knows about,
  so without the announcement a mounted consumer would keep serving a stale material
  after the owning `.tres` changed on disk. `useResource` already answers `invalidated`
  by re-requesting, so no new mechanism was needed.
- Cost: nothing yet resolves a `uid://…::id` reference, and an address whose sub-resource
  id is absent from the file fails like a missing file (cached null → the slot's neutral
  default), which is the intended lenient behaviour but does put the `::` form in front
  of the user in the missing-resources panel if it ever happens.
