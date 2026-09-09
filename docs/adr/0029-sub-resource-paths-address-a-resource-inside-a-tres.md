# A sub-resource path addresses a resource inside a `.tres`

- Status: Accepted (2026-07-28)
- Related: the `resource event bus` / `useResource` seam (ARCHITECTURE.md "Resource
  Loading"), ADR-0022 (uploads are frontend-only), ADR-0028 (import sidecars).
- Closes the "two unjoined halves" gap recorded in
  `packages/textscene-core/src/resources/meshes/comparison.md`.

## Context

A material-, mesh- or texture-valued slot can carry three kinds of reference, and only two
of them resolved:

1. `ExtResource` pointing at a `.tres`. The path-keyed resource pipeline handles it.
2. `SubResource` of the **previewed** `.tscn`. `SceneResourcesContext` plus
   `resolveStandardMaterial` handle it synchronously, since the body is already parsed.
3. `SubResource` of some **other** `.tres` the scene pulled in. Nothing handled it.

Kind 3 is not exotic. Godot writes it whenever a mesh carries its own materials rather
than referencing shared ones. That covered 20 of the corpus's 43 ArrayMesh surface
materials, so every Truck Town vehicle rendered untinted grey.

Nothing was missing in capability. `parseTresFile` already returned the file's
`subResources`, and `tileSetFromTres` already read a sub-resource out of an external
`.tres`. What blocked kind 3 was that it had **no name a cache could be keyed on**.
`ArrayMeshResource.materialPaths` is `(string | null)[]`, `ExternalMaterialSlot` takes a
`path`, and the material pipeline decided "is this a material" from a file extension.

Two shapes were weighed:

- **(A) Address the sub-resource with a path.** Give kind 3 a string, so the existing
  path-keyed machinery keeps working with no consumer change and no signature change:
  processor cache, in-flight dedupe, failure-cached-as-null, `useResource`'s LRU pinning,
  the missing-resources panel.
- **(B) A resolved-descriptor type.** A small union ("material from path" / "material
  from these properties plus this owning file's ext_resource table"), produced by a
  shared resolver and consumed by one component.

## Decision

Adopt (A), with the grammar Godot itself uses: **`res://file.tres::SubId`**. Godot's
text saver writes exactly that as the path of every `[sub_resource]`, and
`ResourceLoader.load()` accepts it. This is the domain's notation, not an invention.

Two rules make it safe, and they are the whole of the design:

- **The whole address is the resource identity.** It is the processor cache key, the
  in-flight key, and what `useResource` pins and subscribes to. Two consumers of one
  sub-resource therefore share one `THREE.Material` by identity, as they already do for
  a whole-file material.
- **Only `filePath` reaches the byte layer.** `createResourceProcessor` normalises the
  address before calling `fileEventBus.request`, so no `ResourceProvider` or hot-reload
  watcher is ever handed a string that is not a real file. The bytes of a sub-resource
  *are* the bytes of the file that owns it. The rule holds going *down*. It does not hold
  coming back *up*, because a failed address is reported under the address (see
  Consequences). So the places a reported path turns back into a fetch normalise:
  `provideFile`, and `MissingResourcesPanel` before it calls a host's upload OR remove
  callback (ADR-0022). Doing it in the panel rather than in each host is deliberate.
  Those callbacks are a pair, and a host that normalised only the upload would store bytes
  under the file and then try to remove them under the address. The web host's
  multi-file drop matcher is a third such route and does NOT normalise. It does not need
  to, because it matches on case-insensitive basename equality, and an address's basename
  still carries its `::id`, so no plausibly-named file matches one.

The normalisation lives in `createResourceProcessor`, not in `FileEventBus`, for three
reasons. The byte bus is deliberately type-agnostic and must stay so. A `shouldProcess`
predicate is a question about a FILE (`path.endsWith('.tres')`) and would break if handed
an address. One arrival can settle several addresses, which is bookkeeping the processor
already owns. Doing it there also means every processor type gains the fetch, cache and
dedupe **plumbing** at once rather than the material one specially.

It does NOT give them the **semantics**. A `process()` that ignores its path would hand
back the whole file's resource and have it cached under the address: a wrong resource
under a right-looking name, the same trap `decodeArrayMesh` had to close. So
`addressesSubResources` is an opt-in flag and the factory refuses an address without it,
loudly. Only the material and ArrayMesh processors declare it. This bounds the "hidden"
claim honestly. It is hidden from every **consumer** holding a path string, which is what
GridMap demonstrates. A **producer** minting addresses for a new resource type must both
mint them and honour `subResourceId` in its own `process()`.

(B) lost on the "hidden" criterion. It is more explicit, but every consumer would learn a
new type, and the three kinds would stay three kinds in the type system. A new slice
would still have to know that kind 3 exists in order to handle it. It would also
duplicate the caching, dedupe and failure semantics the processor already provides, or
give kind 3 different ones.

## Consequences

- `parseSubResourcePath` / `subResourcePath` / `resourceFilePath`
  (`resources/subResourcePath.ts`) are the only place the `::` grammar is written.
- `decodeArrayMesh` and `meshLibraryFromTres` take the path they were loaded from,
  because a sub-resource can only be addressed relative to its own file. The parameter is
  required rather than defaulted. A producer that forgets it is the trap this ADR exists
  to close, so it fails at compile time. Both then emit ordinary path strings, and the
  material consumers (`MeshInstance3D`, `ExternalMaterialSlot`, `GridMap`) needed no
  change at all, which is the check that the seam is hidden from consumers.
- A sub-resource's own texture `ExtResource`s resolve against the **owning `.tres`'s**
  table. Getting this wrong would silently sample the scene's texture of the same id, so
  it is pinned by its own test.
- `decodeArrayMesh` honours an address too, so a `[sub_resource type="ArrayMesh"]` (a
  `shadow_mesh`, a MeshLibrary's embedded item mesh) reads its own `_surfaces`. Without
  that it would have fallen through to the file's `[resource]` body: a *different mesh*
  under the right-looking name for a `shadow_mesh`, and an empty one for a MeshLibrary
  (whose `[resource]` has no `_surfaces` at all). Wrong or blank, but never diagnosed.
  An address naming an id the file does not declare, or one that is not a mesh, warns
  rather than decoding silently to nothing.
- A per-path `clearCache` also drops, and announces `invalidated` for, the addresses
  into that file. A **Dependency hot-reload** re-requests only the file it knows about,
  so without the announcement a mounted consumer would keep serving a stale material
  after the owning `.tres` changed on disk. `useResource` already answers `invalidated`
  by re-requesting, so no new mechanism was needed.
- Cost: nothing resolves a `uid://…::id` reference. An address whose sub-resource id is
  absent from the file fails like a missing file (cached null, then the slot's neutral
  default). That is the intended lenient behaviour, but it does put the `::` form in
  front of the user in the missing-resources panel if it ever happens. Unreachable for a
  well-formed file, because the owner must load before anything inside it can be
  addressed. A mesh carrying a sub-resource type we do not build (an `ORMMaterial3D`,
  say) reaches it on real data, which is why the panel's normalisation is tested rather
  than assumed.
- Cost: this is one seam for resources fetched **through a processor**, not for every
  reader of a `.tres`. `tileSetFromTres` keeps resolving its sources synchronously out of
  an already-parsed `ParsedTresFile`. It has no path to key on and needs none. A
  `SubResource` of the previewed scene remains its own third mechanism
  (`resolveStandardMaterial` over `SceneResourcesContext`). Unifying those was not worth
  churning working code, so "one seam" means one seam for the case that had none.
