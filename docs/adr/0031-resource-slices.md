# Resource decoding is organized as resource slices over one parsed form

- Status: Accepted
- Related: ADR-0001 (unified slice, React-free linter), ADR-0032 (sub-resource paths),
  ADR-0028 (import sidecars), issue #110 (binary `.scn`/`.res`).

## Context

Two decoders for one Godot type, synced by hand, disagree. Without resource slices,
StandardMaterial3D has two such paths. The inline `[sub_resource]` path keeps Godot's
rule that albedo alpha alone must not force transparency. The external `.tres` path
breaks that rule, ignores shipped features (`transparency`, `cull_mode`,
`normal_scale`, refraction, triplanar, …), and re-derives value decoding by sniffing
string shapes. Corpus scenes then render wrong through the weaker path (`truck_town`
tree leaves opaque and single-sided, `glass.tres` without transparency and refraction).
Disjoint test suites for the two paths lock the divergence in.

The loading seam exists. `createTresResourceProcessor` fetches a `.tres` and parses it
into a raw-strings parsed form on the generic `resource` bus slot: "consumers give the
parsed file meaning; the pipeline only fetches and parses the format". TileSet,
MeshLibrary and SpriteFrames consume it. What the consumers need is a uniform shape.
Without one, each decoder chooses its own file layout, entry-point names, value decoding
and registration, so what a contributor implements depends on which decoder they read
first. Routing by guess is part of the problem: a bus tag guessed by substring
(`includes('Material')`) can route a supported type to a processor that then refuses
it (`CanvasItemMaterial` as an `ext_resource`: a working slice behind a permanent
missing-resources row).

## Decision

**Each resource decoder is a resource slice, and each slice consumes one parsed form.**

- A **resource slice** lives in `resources/<category>/<type>/`. It has a registration
  object that declares the TSCN type names and file extensions it claims plus its bus
  tag, a `types.ts`, and co-located tests. Routing is a lookup over the declared claims.
  Nothing sniffs type names by substring.
- Slices come in **two kinds under one contract**. A **Godot-text slice** also carries
  `decode.ts` and `build.ts`. `decode.ts` is pure: a `ParsedResource` section (raw
  property strings plus the owning file's resource tables) in, typed Data out.
  `build.ts` takes Data plus resolved dependencies, and returns a THREE object (or plain
  data). A **foreign-format slice** (glTF/GLB, images, `.import` sidecars,
  `project.godot`) declares its real parser openly and does not fake the split. The
  parity between the kinds is the folder contract, registration and tests, not hollow
  entry-point names.
- The parsed form is **`ParsedResource`**: header type, ext/sub resource tables, and the
  `[resource]` body as raw Godot-text strings. A binary `.res`/`.scn` loader must produce
  the same shape, which makes a decoder format-agnostic. It does not learn which
  serialisation the file used.
- One decoder per type. A type that needs both a reactive (JSX) and an imperative
  applier keeps two adapters over the same `decode.ts`. The decode may not fork.
- Blend/enum tables and similar parity constants are ported from Godot source where
  possible, with `pnpm ref:godot` renders as proof. They are the single source both
  renderers derive from.
- Conformance guards enforce the shape in the existing idiom (registry walk plus source
  scrape). Each claimed type resolves to a slice with the required entry points and
  tests. No code outside the loading layer parses a Godot resource serialisation or
  sniffs the value shapes of a property bag.

## Amendments

- **Naming**: a property-bag decoder is `decode<Type>`. Leaf value scanners
  (`tessellateCurve3D`, `parseCurve3DPoints`, `parseAtlasRegion`) keep `parse*` names,
  because they read one literal, not a bag.
- **Bus tags are the cached-artifact kinds** (`texture` `material` `scene` `glb`
  `resource` `arraymesh` `font` `theme`). Many Godot-text types share the generic
  `resource` slot (a ParsedResource) and give it meaning in their own decode.
  `busType: null` marks a claimed type the loader never serves (`ViewportTexture`
  resolves by NodePath). Such a slice carries no `decode.ts`, because no ParsedResource
  section reaches it.
- **Family-helper registration** (the nine collision shapes, the eight primitive
  meshes) keeps its claims table in the helper's co-located test: one table per family,
  which the conformance guard accepts.
- **Routing by claims**: `CanvasItemMaterial`, the three sky materials (which the
  material bus throws on) and Environment/SpriteFrames/Navigation* (which `provideFile`
  cannot route without a claim) each have a claim. `StyleBoxTexture` is unclaimed on
  purpose. No decode exists, and a claim is a promise of one, so it takes the null-route
  fallback and does not fail inside the image decoder.
- **A Font is two slices, and the split is load-bearing.** The three type names
  (`FontFile`, `SystemFont`, `FontVariation`) are a `godot-text` slice that claims no
  extension and is not binary. The raw containers (`.ttf`/`.otf`/`.woff`/`.woff2`) are
  a separate `foreign-format` slice that claims no type name and carries `binaryBytes`.
  `binaryBytes` is per registration and is read through both `byTypeName` and
  `byExtension`. One slice that declares both would make
  `isBinaryResourceType('FontFile')` true. But a `FontFile` ExtResource as often names a
  text `.tres` wrapper (one that carries `fallbacks`, not font bytes of its own), and
  fetched as bytes it gives a string no parser can read. The extension is the binary
  signal, never the type name.
- **Premultiplied alpha**: Godot's PREMULT blend mode programs blend attachments only.
  three's `premultipliedAlpha` flag adds an in-shader `rgb *= a` that Godot does not
  have, so both renderers keep it off and carry the ported factors.
- **AgX tonemapping** reads `tonemap_agx_white` (default 16.29) per
  `Environment::_update_tonemap`. `tonemap_agx_contrast` goes through both tonemap paths
  (in-material chunk and glow composer), so the two bake one curve.

## Consequences

- To add a resource type, add one slice folder and register it. The loader gets no
  fields, and the routing table cannot drift from the processors.
- `.tres` and inline StandardMaterial3D flow through the same decode, and one
  table-driven suite proves the two arrival paths equivalent.
- The name `ParsedResource` does not bake the text format into a shape that binary files
  share.
