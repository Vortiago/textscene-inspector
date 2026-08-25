# Resource decoding is organized as resource slices over one parsed form

- Status: Accepted (2026-07-31)
- Related: ADR-0001 (unified slice, React-free linter), ADR-0032 (sub-resource paths),
  ADR-0028 (import sidecars), issue #110 (binary `.scn`/`.res`).

## Context

The fifth architecture review found the two StandardMaterial3D paths decoding the same
Godot text through hand-synced implementations that disagree: the inline
`[sub_resource]` path enforces Godot's rule that albedo alpha alone must NOT force
transparency, while the external `.tres` path does exactly that, ignores fifteen
shipped features (`transparency`, `cull_mode`, `normal_scale`, refraction, triplanar,
…), and re-derives value decoding by sniffing string shapes
(`materialProcessing.ts`). Corpus scenes render wrong through the weaker path
(`truck_town` tree leaves opaque and single-sided; `glass.tres` loses transparency and
refraction). The two paths' test suites are disjoint, so the divergence was locked in
rather than caught.

The loading seam itself already existed: `createTresResourceProcessor` fetches a
`.tres` and parses it into a raw-strings parsed form on the generic `resource` bus
slot, documented as "consumers give the parsed file meaning; the pipeline only fetches
and parses the format" — and TileSet, MeshLibrary and SpriteFrames already consume it.
What did not exist was a uniform shape for the consumers. Each decoder chose its own
file layout, entry-point names, value decoding, and registration, so what a
contributor implements depends on which decoder they happen to read first. Routing was
part of the problem: `ResourceLoader.busTypeFor` guessed a bus tag by substring
(`includes('Material')`), so a supported type could route to a processor that then
refused it (`CanvasItemMaterial` as an `ext_resource` — a working slice behind a
permanent missing-resources row).

## Decision

**Every resource decoder is a resource slice, and every slice consumes one parsed
form.**

- A **resource slice** lives in `resources/<category>/<type>/` with a registration
  object declaring the TSCN type names and file extensions it claims plus its bus tag,
  `types.ts`, and co-located tests. Routing is a lookup over the declared claims;
  nothing sniffs type names by substring.
- Slices come in **two kinds under one contract**. A **Godot-text slice** additionally
  carries `decode.ts` — pure, `ParsedResource` section (raw property strings + the
  owning file's resource tables) in, typed Data out — and `build.ts` — Data plus
  resolved dependencies in, THREE object (or plain data) out. A **foreign-format
  slice** (glTF/GLB, images, `.import` sidecars, `project.godot`) declares its real
  parser openly instead of faking the split; the parity here is the folder contract,
  registration, and tests, not hollow entry-point names.
- The parsed form is **`ParsedResource`** (renamed from `ParsedTresFile`): header type,
  ext/sub resource tables, and the `[resource]` body as raw Godot-text strings. A
  future binary `.res`/`.scn` loader (#110) produces the same shape, which is what
  makes a decoder format-agnostic — it never learns which serialization the file used.
- One decoder per type. A type needing both a reactive (JSX) and an imperative
  applier keeps two adapters over the same `decode.ts`; the decode may not fork.
- Blend/enum tables and similar parity constants are ported from Godot source where
  possible, with `pnpm ref:godot` renders as proof, and become the single source both
  renderers derive from.
- Conformance guards enforce the shape in the existing idiom (registry walk + source
  scrape): every claimed type resolves to a slice with the required entry points and
  tests; no code outside the loading layer parses a Godot resource serialization or
  value-shape-sniffs a property bag.

## Decisions made during the campaign (amendments)

- **Naming**: a property-bag decoder is `decode<Type>`; leaf value scanners
  (`tessellateCurve3D`, `parseCurve3DPoints`, `parseAtlasRegion`) keep `parse*`
  names — they read one literal, not a bag.
- **Bus tags are the cached-artifact kinds** (`texture` `material` `scene`
  `glb` `resource` `arraymesh` `font` `theme`); many Godot-text types share the generic
  `resource` slot (a ParsedResource) and give it meaning in their own decode.
  `busType: null` marks a claimed type the loader never serves
  (`ViewportTexture` resolves by NodePath); such a slice carries no `decode.ts`
  because no ParsedResource section ever reaches it.
- **Family-helper registration** (the nine collision shapes, the eight
  primitive meshes) keeps its claims table in the helper's co-located test —
  one table per family, accepted by the conformance guard.
- **Routing fixes shipped by claims**: `CanvasItemMaterial`, the three sky
  materials (previously substring-routed to the material bus, which throws),
  and Environment/SpriteFrames/Navigation* (previously unroutable on
  `provideFile`). `StyleBoxTexture` is deliberately unclaimed — no decode
  exists, and a claim is a promise of one; it now takes the null-route
  fallback instead of failing inside the image decoder.
- **A Font is TWO slices, and that split is load-bearing.** The three type
  names (`FontFile`, `SystemFont`, `FontVariation`) are a `godot-text` slice
  that claims no extension and is NOT binary; the raw containers
  (`.ttf`/`.otf`/`.woff`/`.woff2`) are a separate `foreign-format` slice that
  claims no type name and carries `binaryBytes`. `binaryBytes` is per
  REGISTRATION and read through both `byTypeName` and `byExtension`, so a
  single slice declaring both would make `isBinaryResourceType('FontFile')`
  true — and a `FontFile` ExtResource just as often names a text `.tres`
  wrapper (one carrying `fallbacks` rather than font bytes of its own), which
  fetched as bytes yields a string no parser can read. Merging the two
  registrations reintroduces that; the extension is the binary signal, never
  the type name.
- **Premultiplied alpha**: Godot's PREMULT blend mode programs blend
  attachments only; three's `premultipliedAlpha` flag adds an in-shader
  `rgb *= a` Godot does not have, so both renderers keep it OFF and carry the
  ported factors.
- **AgX tonemapping** reads `tonemap_agx_white` (default 16.29) per
  `Environment::_update_tonemap`, and `tonemap_agx_contrast` is threaded
  through both tonemap paths (in-material chunk and glow composer) so the
  two bake one curve.

## Consequences

- Adding a resource type means adding one slice folder and registering it — the
  loader gains no fields, and the routing table cannot drift from the processors.
- The StandardMaterial3D parity bugs are fixed by construction: `.tres` and inline
  materials flow through the same decode, and one table-driven suite proves the two
  arrival paths equivalent.
- The rename touches every `ParsedTresFile` consumer once, now, while the campaign
  rewrites them anyway; after it, the name no longer bakes the text format into a
  shape binary files will share.
- The campaign lands as one PR so the uniformity is atomic; per-slice work is
  parallelized with disjoint file ownership.
