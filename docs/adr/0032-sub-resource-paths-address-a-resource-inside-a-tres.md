# A sub-resource path addresses a resource inside a `.tres`

- Status: Accepted
- Numbered ADR-0032 because ADR-0029 is the viewport navigation bindings. Pull-request
  descriptions outside the tree call this decision ADR-0029.
- Related: the `resource event bus` / `useResource` seam (ARCHITECTURE.md "Resource
  Loading"), ADR-0022 (uploads are frontend-only), ADR-0028 (import sidecars).

## Context

A slot that holds a material, mesh or texture can carry three kinds of reference:

1. `ExtResource` pointing at a `.tres`. The path-keyed resource pipeline handles it.
2. `SubResource` of the **previewed** `.tscn`. `SceneResourcesContext` plus
   `resolveStandardMaterial` handle it synchronously, since the body is already parsed.
3. `SubResource` of some **other** `.tres` the scene pulled in.

Kind 3 is common. Godot writes it whenever a mesh carries its own materials and does not
reference shared ones. Each Truck Town vehicle is an example: without kind 3 it renders
untinted grey.

The capability exists: `parseTresFile` returns the file's `subResources`, and
`tileSetFromTres` reads a sub-resource out of an external `.tres`. What kind 3 lacks is
**a name a cache can be keyed on**. `ArrayMeshResource.materialPaths` is
`(string | null)[]`, `ExternalMaterialSlot` takes a `path`, and a pipeline that decides
"is this a material" from a file extension cannot see it.

Two shapes were weighed:

- **(A) Address the sub-resource with a path.** Give kind 3 a string, so the path-keyed
  machinery keeps working with no consumer change and no signature change: processor
  cache, in-flight dedupe, failure cached as null, `useResource`'s LRU pinning, the
  missing-resources panel.
- **(B) A resolved-descriptor type.** A small union ("material from path" / "material
  from these properties plus this owning file's ext_resource table"), produced by a
  shared resolver and consumed by one component.

## Decision

Adopt (A), with the grammar Godot itself uses: **`res://file.tres::SubId`**. Godot's text
saver writes that as the path of each `[sub_resource]`, and `ResourceLoader.load()`
accepts it. This is the domain's notation, not an invention.

Two rules make it safe, and they are the whole design:

- **The whole address is the resource identity.** It is the processor cache key, the
  in-flight key, and what `useResource` pins and subscribes to. Two consumers of one
  sub-resource therefore share one `THREE.Material` by identity, as they do for a
  whole-file material.
- **Only `filePath` reaches the byte layer.** `createResourceProcessor` normalises the
  address before it calls `fileEventBus.request`, so no `ResourceProvider` or hot-reload
  watcher gets a string that is not a real file. The bytes of a sub-resource are the
  bytes of the file that owns it. The rule holds going down. It does not hold coming
  back up, because a failed address is reported under the address (see Consequences).
  So each place where a reported path turns back into a fetch normalises: `provideFile`,
  and `MissingResourcesPanel` before it calls a host's upload or remove callback
  (ADR-0022). The panel normalises, not each host, because those callbacks are a pair: a
  host that normalised only the upload would store bytes under the file and then try to
  remove them under the address. The web host's multi-file drop matcher is a third such
  route and does not normalise. It does not need to: it matches on case-insensitive
  basename equality, and an address's basename still carries its `::id`, so no
  plausibly named file matches one.

The normalisation lives in `createResourceProcessor`, not in `FileEventBus`, for three
reasons. The byte bus is type-agnostic on purpose and must stay so. A `shouldProcess`
predicate is a question about a file (`path.endsWith('.tres')`) and would break if it got
an address. One arrival can settle several addresses, which is bookkeeping the processor
owns. Also, each processor type then gets the fetch, cache and dedupe **plumbing** at
once, not the material one alone.

It does not give them the **semantics**. A `process()` that ignores its path would return
the whole file's resource and have it cached under the address: a wrong resource under a
right-looking name, the same trap `decodeArrayMesh` closes. So `addressesSubResources` is
an opt-in flag, and the factory refuses an address without it, loudly. The material,
ArrayMesh, theme and font processors declare it. This bounds the "hidden" claim honestly.
The seam is hidden from each **consumer** that holds a path string, which GridMap shows.
A **producer** that mints addresses for a new resource type must both mint them and
honour `subResourceId` in its own `process()`.

(B) loses on the "hidden" criterion. It is more explicit, but each consumer would learn a
new type, and the three kinds would stay three kinds in the type system. A new slice
would still have to know that kind 3 exists to handle it. It would also duplicate the
caching, dedupe and failure semantics the processor provides, or give kind 3 different
ones.

## Consequences

- `parseSubResourcePath` / `subResourcePath` / `resourceFilePath`
  (`resources/subResourcePath.ts`) are the only place the `::` grammar is written.
- `decodeArrayMesh` and `meshLibraryFromTres` take the path they were loaded from,
  because a sub-resource can only be addressed relative to its own file. The parameter is
  required, not defaulted. A producer that forgets it is the trap this ADR closes, so it
  fails at compile time. Both then emit ordinary path strings, and the material
  consumers (`MeshInstance3D`, `ExternalMaterialSlot`, `GridMap`) need no change, which
  proves the seam is hidden from consumers.
- A sub-resource's own texture `ExtResource`s resolve against the **owning `.tres`'s**
  table. The wrong table silently samples the scene's texture of the same id, so its own
  test pins this.
- `decodeArrayMesh` honours an address too, so a `[sub_resource type="ArrayMesh"]` (a
  `shadow_mesh`, a MeshLibrary's embedded item mesh) reads its own `_surfaces`. Without
  that it falls through to the file's `[resource]` body: a different mesh under the
  right-looking name for a `shadow_mesh`, and an empty one for a MeshLibrary (whose
  `[resource]` has no `_surfaces`). Wrong or blank, and never diagnosed. An address that
  names an id the file does not declare, or one that is not a mesh, warns and does not
  decode silently to nothing.
- A per-path `clearCache` also drops, and announces `invalidated` for, the addresses into
  that file. A **Dependency hot-reload** re-requests only the file it knows about, so
  without the announcement a mounted consumer keeps a stale material after the owning
  `.tres` changes on disk. `useResource` answers `invalidated` by re-requesting, so no
  new mechanism is needed.
- Cost: nothing resolves a `uid://…::id` reference. An address whose sub-resource id is
  absent from the file fails like a missing file (cached null, then the slot's neutral
  default). That is the intended lenient behaviour, but it puts the `::` form in front of
  the user in the missing-resources panel. A well-formed file cannot reach it, because
  the owner must load before anything inside it can be addressed. A mesh that carries a
  sub-resource type the previewer does not build (an `ORMMaterial3D`, for example)
  reaches it on real data, so a test covers the panel's normalisation.
- Cost: this is one seam for resources fetched **through a processor**, not for each
  reader of a `.tres`. `tileSetFromTres` resolves its sources synchronously out of a
  parsed `ParsedResource`. It has no path to key on and needs none. A `SubResource` of
  the previewed scene stays its own third mechanism (`resolveStandardMaterial` over
  `SceneResourcesContext`). Unifying those is not worth churning working code, so "one
  seam" means one seam for the case that had none.
